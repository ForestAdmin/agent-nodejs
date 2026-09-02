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
import warnMissingConfig from '../config/missing-config-warning';

interface BFFHttpServerBaseOptions {
  port: number;
  config: BFFConfig;
  logger?: Logger;
}

/** The server assembles its own Koa app around `/health` and the version header. */
interface AssembledOptions extends BFFHttpServerBaseOptions {
  version: string;
  middlewares?: Middleware[];
  callback?: never;
}

/**
 * The server only listens: `buildBff` already assembled the handler, `/health` and the version
 * header included. `version` and `middlewares` are forbidden here rather than ignored — a host
 * passing them would otherwise boot fine and 404 every one of its own routes.
 */
interface PrebuiltOptions extends BFFHttpServerBaseOptions {
  callback: BffCallback;
  version?: never;
  middlewares?: never;
}

export type BFFHttpServerOptions = AssembledOptions | PrebuiltOptions;

function isPrebuilt(options: BFFHttpServerOptions): options is PrebuiltOptions {
  return options.callback !== undefined;
}

export default class BFFHttpServer {
  private readonly handler: BffCallback;
  private readonly options: BFFHttpServerOptions;
  private readonly logger: Logger;
  private server: Server | null = null;

  constructor(options: BFFHttpServerOptions) {
    this.options = options;
    this.logger = options.logger ?? createConsoleLogger();

    if (isPrebuilt(options)) {
      this.handler = options.callback;

      return;
    }

    this.handler = BFFHttpServer.buildHandler(options);
    warnMissingConfig(options.config, this.logger);
  }

  private static buildHandler(options: AssembledOptions): BffCallback {
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
