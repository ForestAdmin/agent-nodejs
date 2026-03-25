import type { Logger } from '../ports/logger-port';
import type { WorkflowPort } from '../ports/workflow-port';
import type Runner from '../runner';
import type { Server } from 'http';

import bodyParser from '@koa/bodyparser';
import Router from '@koa/router';
import http from 'http';
import Koa from 'koa';
import koaJwt from 'koa-jwt';

import {
  InvalidPendingDataError,
  PendingDataNotFoundError,
  RunNotFoundError,
  StepAlreadyExecutedError,
} from '../errors';

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
  private server: Server | null = null;

  constructor(options: ExecutorHttpServerOptions) {
    this.options = options;
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

        this.options.logger?.error('Unhandled HTTP error', {
          method: ctx.method,
          path: ctx.path,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        ctx.status = 500;
        ctx.body = { error: 'Internal server error' };
      }
    });

    this.app.use(bodyParser());

    // JWT middleware — validates Bearer token using authSecret
    // tokenKey: 'rawToken' exposes the raw token string on ctx.state.rawToken for downstream use
    this.app.use(
      koaJwt({ secret: options.authSecret, cookie: 'forest_session_token', tokenKey: 'rawToken' }),
    );

    const router = new Router();

    // Authorization middleware — verifies that the authenticated user owns the requested run.
    // Applied to all /runs/:runId routes so future routes are automatically protected.
    router.use('/runs/:runId', async (ctx, next) => {
      // Raw token is always present here: koa-jwt already rejected the request if missing.
      const userToken = ctx.state.rawToken as string;

      try {
        const allowed = await this.options.workflowPort.hasRunAccess(ctx.params.runId, userToken);

        if (!allowed) {
          ctx.status = 403;
          ctx.body = { error: 'Forbidden' };

          return;
        }
      } catch (err) {
        this.options.logger?.error('Failed to check run access', {
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
    });

    router.get('/runs/:runId', this.handleGetRun.bind(this));
    router.post('/runs/:runId/trigger', this.handleTrigger.bind(this));
    router.patch(
      '/runs/:runId/steps/:stepIndex/pending-data',
      this.handlePatchPendingData.bind(this),
    );

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

  private async handleGetRun(ctx: Koa.Context): Promise<void> {
    const steps = await this.options.runner.getRunStepExecutions(ctx.params.runId);
    ctx.body = { steps };
  }

  private async handleTrigger(ctx: Koa.Context): Promise<void> {
    const { runId } = ctx.params;

    try {
      await this.options.runner.triggerPoll(runId);
    } catch (err) {
      if (err instanceof RunNotFoundError) {
        ctx.status = 404;
        ctx.body = { error: 'Run not found or unavailable' };

        return;
      }

      throw err;
    }

    ctx.status = 200;
    ctx.body = { triggered: true };
  }

  private async handlePatchPendingData(ctx: Koa.Context): Promise<void> {
    const { runId, stepIndex: stepIndexStr } = ctx.params;
    const stepIndex = parseInt(stepIndexStr, 10);

    if (Number.isNaN(stepIndex)) {
      ctx.status = 400;
      ctx.body = { error: 'Invalid stepIndex' };

      return;
    }

    try {
      await this.options.runner.patchPendingData(runId, stepIndex, ctx.request.body);
    } catch (err) {
      if (err instanceof StepAlreadyExecutedError) {
        ctx.status = 409;
        ctx.body = { error: 'Step has already been executed' };

        return;
      }

      if (err instanceof PendingDataNotFoundError) {
        ctx.status = 404;
        ctx.body = { error: 'Step execution not found or has no pending data' };

        return;
      }

      if (err instanceof InvalidPendingDataError) {
        ctx.status = 400;
        ctx.body = { error: 'Invalid request body', details: err.issues };

        return;
      }

      throw err;
    }

    ctx.status = 204;
  }
}
