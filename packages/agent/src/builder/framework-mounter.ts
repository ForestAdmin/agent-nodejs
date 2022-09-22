/* eslint-disable @typescript-eslint/no-explicit-any */
import { IncomingMessage, ServerResponse, createServer } from 'http';
import { Logger } from '@forestadmin/datasource-toolkit';
import Koa from 'koa';
import Router from '@koa/router';
import path from 'path';

import { HttpCallback } from './types';

export default class FrameworkMounter {
  private onStart: ((router: Router) => Promise<void>)[] = [];
  private onStop: (() => Promise<void>)[] = [];
  private applicationHandler: HttpCallback | null = null;
  private prefix: string;
  private logger: Logger;

  /** Compute the prefix that the main router should be mounted at in the client's application */
  private get completeMountPrefix(): string {
    return path.posix.join('/', this.prefix, 'forest');
  }

  constructor(prefix: string, logger: Logger) {
    this.prefix = prefix;
    this.logger = logger;
    this.handler = this.handler.bind(this);
  }

  async start(router: Router): Promise<void> {
    for (const task of this.onStart) await task(router); // eslint-disable-line no-await-in-loop
  }

  async stop(): Promise<void> {
    for (const task of this.onStop) await task(); // eslint-disable-line no-await-in-loop
  }

  /**
   * Expose the agent on a given port and host
   * @param port port that should be used.
   * @param host host that should be used.
   */
  mountOnStandaloneServer(port = 3351, host = 'localhost'): this {
    const server = createServer(this.handler);
    server.listen(port, host);
    this.logger('Info', `Successfully mounted on Standalone server (http://${host}:${port})`);

    this.onStart.push(async router => {
      const parent = new Router({ prefix: this.completeMountPrefix }).use(router.routes());
      this.applicationHandler = new Koa().use(parent.routes()).callback();
    });

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
    express.use(this.completeMountPrefix, this.handler);
    this.logger('Info', `Successfully mounted on Express.js`);

    this.onStart.push(async router => {
      this.applicationHandler = new Koa().use(router.routes()).callback();
    });

    return this;
  }

  /**
   * Mount the agent on a fastify app
   * @param fastify instance of the fastify app, or of a fastify context
   */
  mountOnFastify(fastify: any): this {
    this.useCallbackOnFastify(fastify, this.handler);
    this.logger('Info', `Successfully mounted on Fastify`);

    this.onStart.push(async router => {
      this.applicationHandler = new Koa().use(router.routes()).callback();
    });

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

    if (adapter.constructor.name === 'ExpressAdapter') {
      nestJs.use(this.completeMountPrefix, this.handler);
    } else {
      this.useCallbackOnFastify(nestJs, this.handler);
    }

    this.logger('Info', `Successfully mounted on NestJS`);

    this.onStart.push(async router => {
      this.applicationHandler = new Koa().use(router.routes()).callback();
    });

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

  private handler(req: IncomingMessage, res: ServerResponse): void {
    if (this.applicationHandler) {
      this.applicationHandler(req, res);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Agent is not started' }));
    }
  }
}
