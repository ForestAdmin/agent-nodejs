/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@forestadmin/datasource-toolkit';

import bodyParser from '@koa/bodyparser';
import Router from '@koa/router';
import { createServer } from 'http';
import Koa from 'koa';
import net from 'net';
import path from 'path';

import { HttpCallback } from './types';

export default class FrameworkMounter {
  public standaloneServerPort: number;

  private readonly onFirstStart: (() => Promise<void>)[] = [];
  private readonly onEachStart: ((
    router: Router,
    mcpHttpCallback?: HttpCallback,
  ) => Promise<void>)[] = [];

  private readonly onStop: (() => Promise<void>)[] = [];
  protected readonly prefix: string;
  private readonly logger: Logger;

  /** Compute the prefix that the main router should be mounted at in the client's application */
  private get completeMountPrefix(): string {
    return path.posix.join('/', this.prefix, 'forest');
  }

  constructor(prefix: string, logger: Logger) {
    this.prefix = prefix;
    this.logger = logger;
  }

  protected async mount(router: Router, mcpHttpCallback?: HttpCallback): Promise<void> {
    for (const task of this.onFirstStart) await task(); // eslint-disable-line no-await-in-loop

    await this.remount(router, mcpHttpCallback);
  }

  protected async remount(router: Router, mcpHttpCallback?: HttpCallback): Promise<void> {
    for (const task of this.onEachStart) await task(router, mcpHttpCallback); // eslint-disable-line no-await-in-loop
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
    // MCP middleware - the callback handles its own path filtering and calls next() for non-MCP routes
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
    // MCP middleware at root - the callback handles its own path filtering
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

    let mcpCallback: HttpCallback | null = null;

    this.onEachStart.push(async (driverRouter, mcpHttpCallback) => {
      // Unmounts previous routes
      parentRouter.stack = [];
      // Mounts new ones
      parentRouter.use(driverRouter.routes());
      // Store the MCP callback
      mcpCallback = mcpHttpCallback || null;
    });

    // MCP middleware - intercepts MCP routes before they reach Koa's body parser
    koa.use(async (ctx: any, next: () => Promise<void>) => {
      const currentMcpCallback = mcpCallback;

      if (currentMcpCallback) {
        // Handle with MCP callback, bypassing Koa processing
        // The MCP callback will call next() if the route is not an MCP route
        await new Promise<void>(resolve => {
          ctx.respond = false;
          currentMcpCallback(ctx.req, ctx.res, () => {
            // next() called means not an MCP route - continue with Koa
            ctx.respond = true;
            resolve();
          });
          ctx.res.once('finish', resolve);
          ctx.res.once('close', resolve);
        });

        if (!ctx.respond) {
          return; // MCP handled the request
        }
      }

      await next();
    });

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
      // MCP middleware at root - the callback handles its own path filtering
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

  private mcpCallback: HttpCallback | null = null;

  /**
   * Get a middleware that forwards requests to the MCP callback if available.
   * The MCP callback itself handles path filtering and calls next() for non-MCP routes.
   */
  private getMcpMiddleware(): HttpCallback {
    // Register to receive MCP callback updates
    this.onEachStart.push(async (_router, mcpHttpCallback) => {
      this.mcpCallback = mcpHttpCallback || null;
    });

    return (req, res, next) => {
      if (this.mcpCallback) {
        this.mcpCallback(req, res, next);
      } else if (next) {
        next();
      }
    };
  }

  private getConnectCallback(nested: boolean): HttpCallback {
    let handler: ((req: any, res: any) => void) | null = null;
    let mcpCallback: HttpCallback | null = null;

    this.onEachStart.push(async (driverRouter, mcpHttpCallback) => {
      let router = driverRouter;

      if (nested) {
        router = new Router({ prefix: this.completeMountPrefix }).use(router.routes());
      }

      handler = new Koa().use(router.routes()).callback();
      mcpCallback = mcpHttpCallback || null;
    });

    return (req, res) => {
      // For standalone server (nested), check MCP callback first
      // The MCP callback handles its own path filtering
      if (nested && mcpCallback) {
        mcpCallback(req, res, () => {
          // next() called means not an MCP route - forward to main handler
          if (handler) {
            handler(req, res);
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Agent is not started' }));
          }
        });

        return;
      }

      if (handler) {
        handler(req, res);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Agent is not started' }));
      }
    };
  }
}
