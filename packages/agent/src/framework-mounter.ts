/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@forestadmin/datasource-toolkit';

import fastifyExpress from '@fastify/express';
import Router from '@koa/router';
import { createServer } from 'http';
import Koa from 'koa';
import net from 'net';
import path from 'path';

import { HttpCallback } from './types';
import expressToKoa from './utils/express-to-koa';

export default class FrameworkMounter {
  public standaloneServerPort: number;

  private readonly onFirstStart: (() => Promise<void>)[] = [];
  private readonly onEachStart: ((router: Router) => Promise<void>)[] = [];

  private readonly onStop: (() => Promise<void>)[] = [];
  protected readonly prefix: string;
  private readonly logger: Logger;

  /** MCP HTTP callback - stored here to avoid passing it through every method */
  private mcpHttpCallback: HttpCallback | null = null;

  /** Compute the prefix that the main router should be mounted at in the client's application */
  private get completeMountPrefix(): string {
    return path.posix.join('/', this.prefix, 'forest');
  }

  constructor(prefix: string, logger: Logger) {
    this.prefix = prefix;
    this.logger = logger;
  }

  /**
   * Set the MCP HTTP callback. Call this before mount() or remount().
   */
  protected setMcpCallback(callback: HttpCallback | null): void {
    this.mcpHttpCallback = callback;
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

    this.onEachStart.push(async driverRouter => {
      // Unmounts previous routes
      parentRouter.stack = [];
      // Mounts new ones
      parentRouter.use(driverRouter.routes());
    });

    // MCP middleware - intercepts MCP routes before they reach Koa's body parser
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
    // In Fastify v4+, fastify.use is undefined until @fastify/middie or @fastify/express is registered
    // In Fastify v2/v3 with middie/express already registered, fastify.use exists
    if (typeof fastify.use !== 'function') {
      // Queue the callback to be registered after @fastify/express is loaded
      this.pendingFastifyCallbacks.push({ callback, prefix });

      // Only register @fastify/express once
      if (!this.fastifyExpressRegistered) {
        // Store reference to pendingCallbacks for use in after() callback
        const pendingCallbacks = this.pendingFastifyCallbacks;

        this.fastifyExpressRegistered = new Promise<void>((resolve, reject) => {
          fastify.register(fastifyExpress).after((err: Error | null) => {
            if (err) {
              this.logger('Error', err.message);
              reject(err);

              return;
            }

            // Register all pending callbacks now that @fastify/express is loaded
            // We use a wrapper that handles path filtering because @fastify/express's
            // path-based middleware has issues with kRoutePrefix in the after() context
            for (const pending of pendingCallbacks) {
              const wrappedCallback = (req: any, res: any, next: any) => {
                if (pending.prefix === '/') {
                  pending.callback(req, res, next);
                } else if (req.url.startsWith(pending.prefix)) {
                  // Strip prefix from URL to simulate Express's prefix-based mounting behavior
                  const originalUrl = req.url;
                  req.url = req.url.slice(pending.prefix.length) || '/';
                  pending.callback(req, res, () => {
                    req.url = originalUrl;
                    next();
                  });
                } else {
                  next();
                }
              };

              fastify.use(wrappedCallback);
            }

            this.pendingFastifyCallbacks = [];
            resolve();
          });
        });
      }

      return;
    }

    try {
      fastify.use(prefix, callback);
    } catch (e) {
      // Fastify 3 throws FST_ERR_MISSING_MIDDLEWARE if middleware support isn't loaded
      if (e.code === 'FST_ERR_MISSING_MIDDLEWARE') {
        // Queue the callback to be registered after @fastify/express is loaded
        this.pendingFastifyCallbacks.push({ callback, prefix });

        // Only register @fastify/express once
        if (!this.fastifyExpressRegistered) {
          // Store reference to pendingCallbacks for use in after() callback
          const pendingCallbacks = this.pendingFastifyCallbacks;

          this.fastifyExpressRegistered = new Promise<void>((resolve, reject) => {
            fastify.register(fastifyExpress).after((err: Error | null) => {
              if (err) {
                this.logger('Error', err.message);
                reject(err);

                return;
              }

              // Register all pending callbacks now that @fastify/express is loaded
              // We use a wrapper that handles path filtering because @fastify/express's
              // path-based middleware has issues with kRoutePrefix in the after() context
              for (const pending of pendingCallbacks) {
                const wrappedCallback = (req: any, res: any, next: any) => {
                  if (pending.prefix === '/') {
                    pending.callback(req, res, next);
                  } else if (req.url.startsWith(pending.prefix)) {
                    // Strip prefix from URL to simulate Express's prefix-based mounting behavior
                    const originalUrl = req.url;
                    req.url = req.url.slice(pending.prefix.length) || '/';
                    pending.callback(req, res, () => {
                      req.url = originalUrl;
                      next();
                    });
                  } else {
                    next();
                  }
                };

                fastify.use(wrappedCallback);
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
   * Get an Express/Connect-style middleware that forwards requests to the MCP callback.
   * The MCP callback handles path filtering and calls next() for non-MCP routes.
   */
  private getMcpMiddleware(): HttpCallback {
    return (req, res, next) => {
      if (this.mcpHttpCallback) {
        this.mcpHttpCallback(req, res, next);
      } else if (next) {
        next();
      }
    };
  }

  /**
   * Get a Koa middleware that forwards requests to the MCP callback.
   * Uses expressToKoa wrapper for proper Koa integration.
   */
  private getMcpKoaMiddleware(): Koa.Middleware {
    return expressToKoa(
      (req, res, next) => {
        if (this.mcpHttpCallback) {
          this.mcpHttpCallback(req, res, next);
        } else if (next) {
          next();
        }
      },
      // MCP routes are at root: /.well-known/*, /oauth/*, /mcp
      url => url.startsWith('/.well-known/') || url.startsWith('/oauth/') || url.startsWith('/mcp'),
    );
  }

  private getConnectCallback(nested: boolean): HttpCallback {
    let handler: ((req: any, res: any) => void) | null = null;

    this.onEachStart.push(async driverRouter => {
      let router = driverRouter;

      if (nested) {
        router = new Router({ prefix: this.completeMountPrefix }).use(router.routes());
      }

      handler = new Koa().use(router.routes()).callback();
    });

    return (req, res) => {
      // For standalone server (nested), check MCP callback first
      // The MCP callback handles its own path filtering
      if (nested && this.mcpHttpCallback) {
        this.mcpHttpCallback(req, res, () => {
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
