import type { BffCallback } from '../build-bff';
import type { BFFConfig } from '../config/env-config';
import type { Logger } from '../ports/logger-port';
import type { Server } from 'http';
import type { Middleware } from 'koa';

import http from 'http';
import Koa from 'koa';

import createHealthRoute from './health-route';
import createVersionHeaderMiddleware from './version-header-middleware';
import createConsoleLogger from '../adapters/console-logger';

export interface BFFHttpServerOptions {
  port: number;
  version: string;
  config: BFFConfig;
  logger?: Logger;
  middlewares?: Middleware[];
  /**
   * Prebuilt request handler, as returned by `buildBff`. When set, the server listens on it as-is
   * and `middlewares` is ignored: the handler already carries `/health` and the version header.
   */
  callback?: BffCallback;
}

export default class BFFHttpServer {
  private readonly handler: BffCallback;
  private readonly options: BFFHttpServerOptions;
  private readonly logger: Logger;
  private server: Server | null = null;

  constructor(options: BFFHttpServerOptions) {
    this.options = options;
    this.logger = options.logger ?? createConsoleLogger();
    this.handler = options.callback ?? BFFHttpServer.buildHandler(options);
  }

  private static buildHandler(options: BFFHttpServerOptions): BffCallback {
    const { config, version } = options;
    const app = new Koa();

    app.use(createVersionHeaderMiddleware(version));
    app.use(createHealthRoute({ config, version }));

    for (const middleware of options.middlewares ?? []) {
      app.use(middleware);
    }

    return app.callback();
  }

  async start(): Promise<void> {
    if (this.server) throw new Error('Server already started');

    return new Promise((resolve, reject) => {
      const server = http.createServer(this.handler);
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
    return this.handler;
  }
}
