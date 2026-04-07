import type { Logger } from '../ports/logger-port';
import type { WorkflowPort } from '../ports/workflow-port';
import type Runner from '../runner';
import type { StepUser } from '../types/execution';
import type { Server } from 'http';

import bodyParser from '@koa/bodyparser';
import Router from '@koa/router';
import http from 'http';
import Koa from 'koa';
import koaJwt from 'koa-jwt';

import ConsoleLogger from '../adapters/console-logger';
import { RunNotFoundError, UserMismatchError } from '../errors';

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
    this.logger = options.logger ?? new ConsoleLogger();
    this.app = new Koa();

    // Error middleware — catches all errors (including JWT 401) and returns structured JSON
    this.app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err: unknown) {
        const { status } = err as { status?: number };

        if (status === 401) {
          ctx.status = 401;
          ctx.body = { error: 'Unauthorized' };

          return;
        }

        this.logger.error('Unhandled HTTP error', {
          method: ctx.method,
          path: ctx.path,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        ctx.status = 500;
        ctx.body = { error: 'Internal server error' };
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
    const user = ctx.state.user as StepUser;

    try {
      const allowed = await this.options.workflowPort.hasRunAccess(ctx.params.runId, user);

      if (!allowed) {
        ctx.status = 403;
        ctx.body = { error: 'Forbidden' };

        return;
      }
    } catch (err) {
      this.logger.error('Failed to check run access', {
        runId: ctx.params.runId,
        method: ctx.method,
        path: ctx.path,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      ctx.status = 503;
      ctx.body = { error: 'Service unavailable' };

      return;
    }

    await next();
  }

  private async handleGetRun(ctx: Koa.Context): Promise<void> {
    const steps = await this.options.runner.getRunStepExecutions(ctx.params.runId);
    ctx.body = { steps };
  }

  private async handleTrigger(ctx: Koa.Context): Promise<void> {
    const { runId } = ctx.params;
    const rawId = (ctx.state.user as { id?: unknown })?.id;
    const bearerUserId = typeof rawId === 'number' ? rawId : Number(rawId);

    if (!Number.isFinite(bearerUserId)) {
      ctx.status = 400;
      ctx.body = { error: 'Missing or invalid user id in token' };

      return;
    }

    const pendingData = (ctx.request.body as { pendingData?: unknown })?.pendingData;

    try {
      await this.options.runner.triggerPoll(runId, {
        pendingData,
        bearerUserId,
      });
    } catch (err) {
      if (err instanceof RunNotFoundError) {
        ctx.status = 404;
        ctx.body = { error: 'Run not found or unavailable' };

        return;
      }

      if (err instanceof UserMismatchError) {
        this.logger.error('User mismatch on trigger', { runId, bearerUserId });
        ctx.status = 403;
        ctx.body = { error: 'Forbidden' };

        return;
      }

      throw err;
    }

    ctx.status = 200;
    ctx.body = { triggered: true };
  }
}
