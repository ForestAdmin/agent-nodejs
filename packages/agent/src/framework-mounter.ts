/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@forestadmin/datasource-toolkit';

import { isMcpRoute } from '@forestadmin/mcp-server';
import Router from '@koa/router';
import { createServer } from 'http';
import Koa from 'koa';
import net from 'net';
import path from 'path';

import { HttpCallback } from './types';

export default class FrameworkMounter {
  public standaloneServerPort: number;

  private readonly onFirstStart: (() => Promise<void>)[] = [];
  private readonly onEachStart: ((router: Router) => Promise<void>)[] = [];

  private readonly onStop: (() => Promise<void>)[] = [];
  protected readonly prefix: string;
  private readonly logger: Logger;

  /** MCP Router - stored here to be mounted on various frameworks */
  private mcpRouter: Router | null = null;

  /** Compute the prefix that the main router should be mounted at in the client's application */
  private get completeMountPrefix(): string {
    return path.posix.join('/', this.prefix, 'forest');
  }

  constructor(prefix: string, logger: Logger) {
    this.prefix = prefix;
    this.logger = logger;
  }

  /**
   * Set the MCP Router. Call this before mount() or remount().
   */
  protected setMcpRouter(router: Router | null): void {
    this.mcpRouter = router;
  }

  protected async mount(router: Router): Promise<void> {
    for (const task of this.onFirstStart) await task(); // eslint-disable-line no-await-in-loop

    await this.remount(router);
  }

  protected async remount(router: Router): Promise<void> {
    for (const task of this.onEachStart) await task(router); // eslint-disable-line no-await-in-loop
  }

  public async stop(): Promise<void> {
    for (const task of this.onStop) await task(); // eslint-disable-line no-await-in-loop
  }

  /**
   * Expose the agent on a given port and host
   * @param port port that should be used, defaults to 3351 or to the `PORT` environment variable.
   * O will be set a random available port and the port will be available in the `standaloneServerPort` property.
   * @param host host that should be used, default to the unspecified IPv6 address (::) when IPv6
   *  is available, or the unspecified IPv4 address (0.0.0.0) otherwise.
   */
  mountOnStandaloneServer(port?: number, host?: string): this {
    const portFromEnv = Number(process.env.PORT) || undefined;
    const chosenPort = port ?? portFromEnv ?? 3351;
    const server = createServer(this.getConnectCallback(true));

    this.onFirstStart.push(() => {
      return new Promise<void>((resolve, reject) => {
        server.listen(chosenPort, host, () => {
          this.standaloneServerPort = (server.address() as net.AddressInfo).port;
          this.logger(
            'Info',
            `Successfully mounted on Standalone server (http://${host ?? '0.0.0.0'}:${
              this.standaloneServerPort
            })`,
          );

          this.onStop.push(async () => {
            await new Promise<void>((resolveStop, rejectStop) => {
              server.close((err: any) => {
                if (err) {
                  rejectStop(err);
                } else {
                  resolveStop();
                }
              });
            });
          });

          resolve();
        });
        server.on('error', reject);
      });
    });

    return this;
  }

  /**
   * Mount the agent on an express app.
   * @param express instance of the express app or router.
   */
  mountOnExpress(express: any): this {
    // MCP middleware - uses the Koa router callback
    express.use(this.getMcpMiddleware());

    // Mount main forest routes at /{prefix}/forest
    express.use(this.completeMountPrefix, this.getConnectCallback(false));

    this.logger('Info', `Successfully mounted on Express.js`);

    return this;
  }

  /**
   * Mount the agent on a fastify app
   * @param fastify instance of the fastify app, or of a fastify context
   */
  mountOnFastify(fastify: any): this {
    // MCP middleware at root
    this.useCallbackOnFastify(fastify, this.getMcpMiddleware(), '/');

    // Mount main forest routes
    const callback = this.getConnectCallback(false);
    this.useCallbackOnFastify(fastify, callback, this.completeMountPrefix);

    this.logger('Info', `Successfully mounted on Fastify`);

    return this;
  }

  /**
   * Mount the agent on a koa app
   * @param koa instance of a koa app or a koa Router.
   */
  mountOnKoa(koa: any): this {
    const parentRouter = new Router({ prefix: this.completeMountPrefix });

    // Default route middleware, it will be removed after starting the agent
    parentRouter.get('/', ctx => {
      ctx.response.status = 200;
      ctx.response.body = { error: 'Agent is not started' };
    });

    this.onEachStart.push(async driverRouter => {
      // Unmounts previous routes
      parentRouter.stack = [];
      // Mounts new ones
      parentRouter.use(driverRouter.routes());
    });

    // MCP routes - mounted at root level (native Koa)
    koa.use(this.getMcpKoaMiddleware());
    koa.use(parentRouter.routes());
    this.logger('Info', `Successfully mounted on Koa`);

    return this;
  }

  /**
   * Mount the agent on a NestJS app
   * @param nestJs instance of a NestJS application
   */
  mountOnNestJs(nestJs: any): this {
    const adapter = nestJs.getHttpAdapter();
    const callback = this.getConnectCallback(false);

    if (adapter.constructor.name === 'ExpressAdapter') {
      // MCP middleware at root
      nestJs.use(this.getMcpMiddleware());
      // Mount main forest routes
      nestJs.use(this.completeMountPrefix, callback);
    } else {
      // Fastify adapter - MCP middleware at root
      this.useCallbackOnFastify(nestJs, this.getMcpMiddleware(), '/');
      this.useCallbackOnFastify(nestJs, callback, this.completeMountPrefix);
    }

    this.logger('Info', `Successfully mounted on NestJS`);

    return this;
  }

  private fastifyExpressRegistered: Promise<void> | null = null;
  private pendingFastifyCallbacks: Array<{ callback: HttpCallback; prefix: string }> = [];

  private useCallbackOnFastify(fastify: any, callback: HttpCallback, prefix: string): void {
    try {
      // 'fastify 2' or 'middie' or 'fastify-express'
      fastify.use(prefix, callback);
    } catch (e) {
      // 'fastify 3'
      if (e.code === 'FST_ERR_MISSING_MIDDLEWARE') {
        // Queue the callback to be registered after @fastify/express is loaded
        this.pendingFastifyCallbacks.push({ callback, prefix });

        // Only register @fastify/express once
        if (!this.fastifyExpressRegistered) {
          this.fastifyExpressRegistered = new Promise<void>((resolve, reject) => {
            fastify.register(import('@fastify/express')).after((err: Error | null) => {
              if (err) {
                this.logger('Error', err.message);
                reject(err);

                return;
              }

              // Register all pending callbacks
              for (const pending of this.pendingFastifyCallbacks) {
                fastify.use(pending.prefix, pending.callback);
              }

              this.pendingFastifyCallbacks = [];
              resolve();
            });
          });
        }
      } else {
        throw e;
      }
    }
  }

  /**
   * Get an Express/Connect-style middleware that forwards MCP requests to the Koa router.
   * Non-MCP routes are passed to the next middleware.
   */
  private getMcpMiddleware(): HttpCallback {
    return (req, res, next) => {
      const url = req.url || '/';

      if (!isMcpRoute(url)) {
        if (next) next();

        return;
      }

      if (this.mcpRouter) {
        // Create a minimal Koa app to handle the request
        const app = new Koa();
        app.use(this.mcpRouter.routes());
        app.use(this.mcpRouter.allowedMethods());
        app.callback()(req, res);
      } else if (next) {
        next();
      }
    };
  }

  /**
   * Get a Koa middleware that handles MCP routes using the native Koa router.
   */
  private getMcpKoaMiddleware(): Koa.Middleware {
    return async (ctx, next) => {
      if (!isMcpRoute(ctx.url)) {
        await next();

        return;
      }

      if (this.mcpRouter) {
        // Create a minimal Koa app to handle the request with the router
        const app = new Koa();
        app.use(this.mcpRouter.routes());
        app.use(this.mcpRouter.allowedMethods());

        // Use the app callback directly on the raw request/response
        await app.callback()(ctx.req, ctx.res);
        ctx.respond = false; // Tell Koa we've handled the response
      } else {
        await next();
      }
    };
  }

  private getConnectCallback(nested: boolean): HttpCallback {
    let handler: ((req: any, res: any) => void) | null = null;

    this.onEachStart.push(async driverRouter => {
      let router = driverRouter;

      if (nested) {
        router = new Router({ prefix: this.completeMountPrefix }).use(router.routes());
      }

      // Include MCP router in nested mode (standalone server)
      const app = new Koa();

      if (nested && this.mcpRouter) {
        app.use(this.mcpRouter.routes());
        app.use(this.mcpRouter.allowedMethods());
      }

      app.use(router.routes());
      handler = app.callback();
    });

    return (req, res) => {
      if (handler) {
        handler(req, res);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Agent is not started' }));
      }
    };
  }
}
