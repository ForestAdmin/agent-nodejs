import type { Logger } from '../ports/logger-port';
import type { RunStore } from '../ports/run-store';
import type Runner from '../runner';
import type { Server } from 'http';

import Router from '@koa/router';
import http from 'http';
import Koa from 'koa';

export interface ExecutorHttpServerOptions {
  port: number;
  runStore: RunStore;
  runner: Runner;
  logger?: Logger;
}

export default class ExecutorHttpServer {
  private readonly app: Koa;
  private readonly options: ExecutorHttpServerOptions;
  private server: Server | null = null;

  constructor(options: ExecutorHttpServerOptions) {
    this.options = options;
    this.app = new Koa();

    // Error middleware — catches all async handler errors and returns structured JSON
    this.app.use(async (ctx, next) => {
      try {
        await next();
      } catch (err: unknown) {
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

    const router = new Router();
    router.get('/runs/:runId', this.handleGetRun.bind(this));
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

  private async handleGetRun(ctx: Koa.Context): Promise<void> {
    const { runId } = ctx.params;
    const steps = await this.options.runStore.getStepExecutions(runId);

    ctx.body = { steps };
  }

  private async handleTrigger(ctx: Koa.Context): Promise<void> {
    const { runId } = ctx.params;

    await this.options.runner.triggerPoll(runId);

    ctx.status = 200;
    ctx.body = { triggered: true };
  }
}
