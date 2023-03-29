/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { createServer } from 'http';
import Koa from 'koa';
import path from 'path';

import { HttpCallback } from './types';

export default class FrameworkMounter {
  private readonly onStart: ((router: Router) => Promise<void>)[] = [];
  private readonly onStop: (() => Promise<void>)[] = [];
  private readonly prefix: string;
  private readonly logger: Logger;

  /** Compute the prefix that the main router should be mounted at in the client's application */
  private get completeMountPrefix(): string {
    return path.posix.join('/', this.prefix, 'forest');
  }

  constructor(prefix: string, logger: Logger) {
    this.prefix = prefix;
    this.logger = logger;
  }

  async start(router: Router): Promise<void> {
    for (const task of this.onStart) await task(router); // eslint-disable-line no-await-in-loop
  }

  async stop(): Promise<void> {
    for (const task of this.onStop) await task(); // eslint-disable-line no-await-in-loop
  }

  /**
   * Expose the agent on a given port and host
   * @param port port that should be used, defaults to 3351 or to the `PORT` environment variable.
   * @param host host that should be used, default to the unspecified IPv6 address (::) when IPv6
   *  is available, or the unspecified IPv4 address (0.0.0.0) otherwise.
   */
  mountOnStandaloneServer(port?: number, host?: string): this {
    const chosenPort = port || Number(process.env.PORT) || 3351;
    const server = createServer(this.getConnectCallback(true));
    const isListeningPromise = new Promise<void>((resolve, reject) => {
      server.listen(chosenPort, host, () => {
        this.logger(
          'Info',
          `Successfully mounted on Standalone server (http://${host ?? '0.0.0.0'}:${port})`,
        );
        resolve();
      });
      server.on('error', reject);
    });
    this.onStart.push(async () => isListeningPromise);

    this.onStop.push(async () => {
      server.close();
    });

    return this;
  }

  /**
   * Mount the agent on an express app.
   * @param express instance of the express app or router.
   */
  mountOnExpress(express: any): this {
    express.use(this.completeMountPrefix, this.getConnectCallback(false));
    this.logger('Info', `Successfully mounted on Express.js`);

    return this;
  }

  /**
   * Mount the agent on a fastify app
   * @param fastify instance of the fastify app, or of a fastify context
   */
  mountOnFastify(fastify: any): this {
    const callback = this.getConnectCallback(false);
    this.useCallbackOnFastify(fastify, callback);

    this.logger('Info', `Successfully mounted on Fastify`);

    return this;
  }

  /**
   * Mount the agent on a koa app
   * @param koa instance of a koa app or a koa Router.
   */
  mountOnKoa(koa: any): this {
    const parentRouter = new Router({ prefix: this.completeMountPrefix });

    koa.use(parentRouter.routes());
    this.logger('Info', `Successfully mounted on Koa`);

    this.onStart.push(async router => {
      parentRouter.use(router.routes());
    });

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
      nestJs.use(this.completeMountPrefix, callback);
    } else {
      this.useCallbackOnFastify(nestJs, callback);
    }

    this.logger('Info', `Successfully mounted on NestJS`);

    return this;
  }

  private useCallbackOnFastify(fastify: any, callback: HttpCallback): void {
    try {
      // 'fastify 2' or 'middie' or 'fastify-express'
      fastify.use(this.completeMountPrefix, callback);
    } catch (e) {
      // 'fastify 3'
      if (e.code === 'FST_ERR_MISSING_MIDDLEWARE') {
        fastify
          .register(import('@fastify/express'))
          .then(() => {
            fastify.use(this.completeMountPrefix, callback);
          })
          .catch(err => {
            this.logger('Error', err.message);
          });
      } else {
        throw e;
      }
    }
  }

  private getConnectCallback(nested: boolean): HttpCallback {
    let handler = null;

    this.onStart.push(async driverRouter => {
      let router = driverRouter;

      if (nested) {
        router = new Router({ prefix: this.completeMountPrefix }).use(router.routes());
      }

      handler = new Koa().use(router.routes()).callback();
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
