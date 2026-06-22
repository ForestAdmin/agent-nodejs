import type { Logger } from '../ports/logger-port';
import type { WorkflowPort } from '../ports/workflow-port';
import type Runner from '../runner';
import type { Server } from 'http';

import bodyParser from '@koa/bodyparser';
import Router from '@koa/router';
import http from 'http';
import Koa from 'koa';
import koaJwt from 'koa-jwt';

import { type BearerClaims, BearerClaimsSchema } from './bearer-claims';
import {
  ForbiddenHttpError,
  ServiceUnavailableHttpError,
  UnauthorizedHttpError,
  toHttpError,
} from './http-errors';
import serializeStepForWire from './step-serializer';
import createConsoleLogger from '../adapters/console-logger';
import { extractErrorMessage } from '../errors';

// eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require, global-require
const { version } = require('../../package.json') as { version: string };

export interface ExecutorHttpServerOptions {
  port: number;
  runner: Runner;
  authSecret: string;
  workflowPort: WorkflowPort;
  logger?: Logger;
}

export default class ExecutorHttpServer {
  private readonly app: Koa;
  private readonly options: ExecutorHttpServerOptions;
  private readonly logger: Logger;
  private server: Server | null = null;

  constructor(options: ExecutorHttpServerOptions) {
    this.options = options;
    this.logger = options.logger ?? createConsoleLogger();
    this.app = new Koa();

    this.app.use(async (ctx, next) => {
      ctx.set('X-Executor-Version', version);
      await next();
    });

    // Error-translation middleware — the single place converting thrown errors (typed HTTP
    // errors, domain errors via toHttpError, JWT 401) into HTTP responses. Handlers just throw.
    this.app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err: unknown) {
        const httpError = toHttpError(err);

        if (!httpError) {
          this.logger('Error', 'Unhandled HTTP error', {
            method: ctx.method,
            path: ctx.path,
            error: extractErrorMessage(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
          ctx.status = 500;
          ctx.body = { error: 'Internal server error' };

          return;
        }

        if (httpError.log) {
          this.logger('Error', 'HTTP request failed', {
            method: ctx.method,
            path: ctx.path,
            status: httpError.status,
            error: extractErrorMessage(httpError.cause ?? httpError),
            // Prefer the cause's stack (points at the real fault site); fall back to the HTTP
            // error's own stack so a log:true error without a cause never logs an empty stack.
            stack:
              (httpError.cause instanceof Error ? httpError.cause.stack : undefined) ??
              httpError.stack,
          });
        }

        ctx.status = httpError.status;
        ctx.body = { error: httpError.userMessage };
      }
    });

    // Health endpoint — before JWT so it's publicly accessible (infra probes don't send tokens)
    this.app.use(async (ctx, next) => {
      if (ctx.method === 'GET' && ctx.path === '/health') {
        const { state } = this.options.runner;
        ctx.status = state === 'running' || state === 'draining' ? 200 : 503;
        ctx.body = { state };

        return;
      }

      await next();
    });

    this.app.use(bodyParser());

    // JWT middleware — validates Bearer token using authSecret
    // tokenKey: 'rawToken' exposes the raw token string on ctx.state.rawToken for downstream use
    this.app.use(
      koaJwt({ secret: options.authSecret, cookie: 'forest_session_token', tokenKey: 'rawToken' }),
    );

    // koa-jwt only validates the token's signature/expiry, not its payload shape. Validate the
    // claims once, here, so every handler downstream gets a user with a guaranteed numeric id.
    this.app.use(async (ctx, next) => {
      const claims = BearerClaimsSchema.safeParse(ctx.state.user);

      if (!claims.success) {
        // A token koa-jwt accepted (valid signature) but whose payload is malformed is rare and
        // high-signal (token-issuance regression / version skew / forgery probe) — log it, unlike
        // ordinary expired-token churn. Only the issue paths/codes, never the payload (PII).
        this.logger('Warn', 'Bearer token has invalid claims', {
          method: ctx.method,
          path: ctx.path,
          issues: claims.error.issues.map(issue => ({ path: issue.path, code: issue.code })),
        });

        throw new UnauthorizedHttpError();
      }

      ctx.state.user = { ...ctx.state.user, ...claims.data };

      await next();
    });

    const router = new Router();

    // hasRunAccess authorization — only on GET (read-only route).
    // Trigger handles its own authz by comparing bearer user with step.user.
    router.get(
      '/runs/:runId',
      this.hasRunAccessMiddleware.bind(this),
      this.handleGetRun.bind(this),
    );
    router.post('/runs/:runId/trigger', this.handleTrigger.bind(this));

    this.app.use(router.routes());
    this.app.use(router.allowedMethods());
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.app.callback());
      this.server.once('error', reject);
      this.server.listen(this.options.port, resolve);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();

        return;
      }

      this.server.close(err => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          resolve();
        }
      });
    });
  }

  get callback() {
    return this.app.callback();
  }

  private async hasRunAccessMiddleware(ctx: Koa.Context, next: Koa.Next): Promise<void> {
    const user = ctx.state.user as BearerClaims;
    let allowed: boolean;

    try {
      allowed = await this.options.workflowPort.hasRunAccess(ctx.params.runId, user);
    } catch (err) {
      this.logger('Error', 'Failed to check run access', {
        runId: ctx.params.runId,
        method: ctx.method,
        path: ctx.path,
        error: extractErrorMessage(err),
        stack: err instanceof Error ? err.stack : undefined,
      });

      // log:false — already logged above with the richer runId context.
      throw new ServiceUnavailableHttpError('Service unavailable', { cause: err });
    }

    if (!allowed) throw new ForbiddenHttpError();

    await next();
  }

  private async handleGetRun(ctx: Koa.Context): Promise<void> {
    const steps = await this.options.runner.getRunStepExecutions(ctx.params.runId);
    ctx.body = { steps: steps.map(serializeStepForWire) };
  }

  private async handleTrigger(ctx: Koa.Context): Promise<void> {
    const { runId } = ctx.params;
    // Guaranteed a number by the bearer-claims middleware.
    const bearerUserId = (ctx.state.user as BearerClaims).id;

    const pendingData = (ctx.request.body as { pendingData?: unknown })?.pendingData;

    await this.options.runner.triggerPoll(runId, { pendingData, bearerUserId });

    ctx.status = 200;
    ctx.body = { triggered: true };
  }
}
