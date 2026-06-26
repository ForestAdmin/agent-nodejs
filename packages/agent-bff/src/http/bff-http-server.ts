import type { BFFConfig } from '../config/env-config';
import type { Logger } from '../ports/logger-port';
import type { Server } from 'http';
import type { Middleware } from 'koa';

import http from 'http';
import Koa from 'koa';

import createConsoleLogger from '../adapters/console-logger';

export interface BFFHttpServerOptions {
  port: number;
  version: string;
  config: BFFConfig;
  logger?: Logger;
  middlewares?: Middleware[];
}

export default class BFFHttpServer {
  private readonly app: Koa;
  private readonly options: BFFHttpServerOptions;
  private readonly logger: Logger;
  private server: Server | null = null;

  constructor(options: BFFHttpServerOptions) {
    this.options = options;
    this.logger = options.logger ?? createConsoleLogger();
    this.app = new Koa();

    this.app.use(async (ctx, next) => {
      ctx.set('X-Forest-Bff-Version', this.options.version);
      await next();
    });

    this.app.use(async (ctx, next) => {
      if ((ctx.method === 'GET' || ctx.method === 'HEAD') && ctx.path === '/health') {
        const { config, version } = this.options;
        ctx.status = config.hasAllRequired ? 200 : 503;
        ctx.body = { status: config.hasAllRequired ? 'ok' : 'degraded', version };

        return;
      }

      await next();
    });

    for (const middleware of this.options.middlewares ?? []) {
      this.app.use(middleware);
    }
  }

  async start(): Promise<void> {
    if (this.server) throw new Error('Server already started');

    return new Promise((resolve, reject) => {
      const server = http.createServer(this.app.callback());
      this.server = server;
      let onError: (error: Error) => void;

      const onListening = () => {
        server.removeListener('error', onError);
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : this.options.port;
        this.logger('Info', 'Forest BFF started', { port });

        const missing = Object.entries(this.options.config.presence)
          .filter(([, present]) => !present)
          .map(([key]) => key);

        if (missing.length > 0) {
          this.logger('Warn', 'Missing required configuration; /health will report degraded', {
            missing,
          });
        }

        resolve();
      };

      onError = (error: Error) => {
        server.removeListener('listening', onListening);
        if (this.server === server) this.server = null;
        reject(error);
      };

      server.once('error', onError);
      server.listen(this.options.port, onListening);
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
}
