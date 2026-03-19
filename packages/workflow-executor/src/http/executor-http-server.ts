import type { RunStoreFactory } from './run-store-factory';
import type WorkflowRunner from '../runner';
import type { Server } from 'http';

import Router from '@koa/router';
import http from 'http';
import Koa from 'koa';

export interface ExecutorHttpServerOptions {
  port: number;
  runStoreFactory: RunStoreFactory;
  workflowRunner: WorkflowRunner;
}

export default class ExecutorHttpServer {
  private readonly app: Koa;
  private readonly options: ExecutorHttpServerOptions;
  private server: Server | null = null;

  constructor(options: ExecutorHttpServerOptions) {
    this.options = options;
    this.app = new Koa();

    const router = new Router();
    router.get('/runs/:runId', this.handleGetRun.bind(this));
    router.post('/runs/:runId/trigger', this.handleTrigger.bind(this));

    this.app.use(router.routes());
    this.app.use(router.allowedMethods());
  }

  async start(): Promise<void> {
    return new Promise(resolve => {
      this.server = http.createServer(this.app.callback());
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
        this.server = null;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  get callback() {
    return this.app.callback();
  }

  private async handleGetRun(ctx: Koa.Context): Promise<void> {
    const { runId } = ctx.params;
    const runStore = this.options.runStoreFactory.buildRunStore(runId);

    if (!runStore) {
      ctx.status = 404;
      ctx.body = { error: `Run "${runId}" not found` };

      return;
    }

    const steps = await runStore.getStepExecutions();

    ctx.body = { steps };
  }

  private async handleTrigger(ctx: Koa.Context): Promise<void> {
    const { runId } = ctx.params;

    await this.options.workflowRunner.triggerPoll(runId);

    ctx.status = 200;
    ctx.body = { triggered: true };
  }
}
