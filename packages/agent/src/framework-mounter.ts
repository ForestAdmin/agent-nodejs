/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Logger } from '@forestadmin/datasource-toolkit';

import bodyParser from '@koa/bodyparser';
import Router from '@koa/router';
import { createServer } from 'http';
import Koa from 'koa';
import net from 'net';
import path from 'path';

import { HttpCallback } from './types';

/**
 * MCP-specific paths that should be handled by the MCP server.
 * Note: This is intentionally duplicated from @forestadmin/mcp-server to avoid
 * circular dependencies (mcp-server tests import from agent via testing utils).
 */
const MCP_PATHS = ['/.well-known/', '/oauth/', '/mcp'];

/** Check if a URL is an MCP route */
function isMcpRoute(url: string): boolean {
  return MCP_PATHS.some(p => url === p || url.startsWith(p));
}

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
    // Mount MCP callback - it will only respond to MCP-specific routes
    // and call next() for non-MCP routes
    const mcpCallback = this.getMcpCallback();

    if (mcpCallback) {
      express.use(mcpCallback);
    }

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
    // Mount MCP callback at root - it will only respond to MCP-specific routes
    const mcpCallback = this.getMcpCallback();

    if (mcpCallback) {
      this.useCallbackOnFastify(fastify, mcpCallback, '/');
    }

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

    // Store MCP callback for use in middleware
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
      const url = ctx.url || '/';

      if (isMcpRoute(url) && mcpCallback) {
        // Handle MCP route directly with the HTTP callback, bypassing Koa processing
        await new Promise<void>(resolve => {
          ctx.respond = false;
          mcpCallback!(ctx.req, ctx.res, () => {
            // If next() is called by the callback, it means no route matched
            ctx.respond = true;
            ctx.status = 404;
            ctx.body = { error: 'Not found' };
            resolve();
          });
          ctx.res.once('finish', resolve);
          ctx.res.once('close', resolve);
        });
      } else {
        await next();
      }
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
    const mcpCallback = this.getMcpCallback();

    if (adapter.constructor.name === 'ExpressAdapter') {
      // Mount MCP callback at root - it will only respond to MCP-specific routes
      if (mcpCallback) {
        nestJs.use(mcpCallback);
      }

      // Mount main forest routes
      nestJs.use(this.completeMountPrefix, callback);
    } else {
      // Fastify adapter - mount MCP at root
      if (mcpCallback) {
        this.useCallbackOnFastify(nestJs, mcpCallback, '/');
      }

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

  private mcpCallbackRegistered = false;
  private mcpHttpCallback: HttpCallback | null = null;

  /**
   * Get the MCP callback that handles MCP-specific routes.
   * Returns null if no MCP callback will be registered.
   * The callback filters requests by path and only handles MCP routes,
   * calling next() for non-MCP routes.
   */
  private getMcpCallback(): HttpCallback | null {
    // Only register the callback handler once
    if (!this.mcpCallbackRegistered) {
      this.mcpCallbackRegistered = true;
      this.onEachStart.push(async (_driverRouter, mcpHttpCallback) => {
        this.mcpHttpCallback = mcpHttpCallback || null;
      });
    }

    return (req, res, next) => {
      const url = req.url || '/';

      if (isMcpRoute(url) && this.mcpHttpCallback) {
        // Call the MCP HTTP callback directly (Express app from mcp-server)
        this.mcpHttpCallback(req, res, next);
      } else if (next) {
        // Not an MCP route or handler not ready, pass to next middleware
        next();
      } else {
        // No next callback - this is the end of the chain
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
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

      const app = new Koa();

      // Body parser middleware - required for nested standalone server
      if (nested) {
        app.use(
          bodyParser({
            encoding: 'utf-8',
            parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
          }),
        );
      }

      app.use(router.routes());

      handler = app.callback();
      mcpCallback = mcpHttpCallback || null;
    });

    return (req, res) => {
      const url = req.url || '/';

      // For standalone server (nested), check if this is an MCP route first
      if (nested && mcpCallback && isMcpRoute(url)) {
        // Handle MCP route directly with the HTTP callback
        mcpCallback(req, res);

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
