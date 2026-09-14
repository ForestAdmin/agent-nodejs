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

/** How long `stop()` waits for the open connections before it destroys them and drains anyway. */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

interface BFFHttpServerBaseOptions {
  port: number;
  config: BFFConfig;
  logger?: Logger;
  /** Overrides `SHUTDOWN_TIMEOUT_MS`, for a host whose orchestrator grants a different grace. */
  shutdownTimeoutMs?: number;
  /**
   * Waits for the work no connection holds: the activity-log status transitions are fired without
   * `await`, so `close()` does not cover them and a shutdown would leave entries `pending`. Takes
   * what is left of the shutdown deadline and returns what that deadline cut short.
   */
  drainActivityLogs?: (timeoutMs?: number) => Promise<string[]>;
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
    app.use(
      createHealthRoute({
        version,
        healthy: config.hasAllRequired,
        configured: {
          oauth: Boolean(config.tokenEncryptionKey),
          ai: Boolean(config.tokenEncryptionKey),
          cors: config.allowedOrigins.length > 0,
          openapi: config.openapiEnabled,
        },
      }),
    );

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

  /**
   * The drain shares the connection deadline rather than getting one of its own: `stop()` as a
   * whole has to fit the grace the orchestrator gives the process, and a status transition against
   * a slow audit store retries long enough to outlast it on its own.
   */
  async stop(): Promise<void> {
    const { drainActivityLogs } = this.options;
    const timeoutMs = this.shutdownTimeoutMs;
    const deadline = Date.now() + timeoutMs;

    await this.closeConnections(timeoutMs);

    if (!drainActivityLogs) return;

    const unfinished = await drainActivityLogs(Math.max(deadline - Date.now(), 0));

    if (unfinished.length === 0) return;

    this.logger('Warn', 'Stopped the Forest BFF with activity logs still in flight', {
      timeoutMs,
      unfinished,
    });
  }

  private get shutdownTimeoutMs(): number {
    return this.options.shutdownTimeoutMs ?? SHUTDOWN_TIMEOUT_MS;
  }

  /**
   * Bounded on purpose: `close()` resolves only once the last connection is gone, so a single busy
   * one would hold the shutdown until the orchestrator sends SIGKILL and the drain would never
   * run. Idle keep-alive connections go first, the rest get the deadline and are then destroyed.
   */
  private async closeConnections(timeoutMs: number): Promise<void> {
    const { server } = this;

    if (!server) return;

    return new Promise((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        settled = true;
        this.logger('Warn', 'Forcing the Forest BFF shutdown: connections were still open', {
          timeoutMs,
        });
        server.closeAllConnections();
        this.server = null;
        resolve();
      }, timeoutMs);

      server.close(err => {
        if (settled) return;

        settled = true;
        clearTimeout(timer);

        if (err) {
          reject(err);
        } else {
          this.server = null;
          resolve();
        }
      });

      server.closeIdleConnections();
    });
  }

  get callback() {
    return this.handler;
  }
}
