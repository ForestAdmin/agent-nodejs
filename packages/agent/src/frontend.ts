import { DataSource } from '@forestadmin/datasource-toolkit';
import cors from '@koa/cors';
import Router from '@koa/router';
import { IncomingMessage, ServerResponse } from 'http';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import BaseRoute from './routes/base-route';
import HealthCheck from './routes/healthcheck';
import { FrontendOptions } from './types';

/** Native NodeJS callback that can be passed to an HTTP Server */
export type HttpCallback = (req: IncomingMessage, res: ServerResponse) => void;

/**
 * List of routes constructors. One instance = One exposed route.
 */
const ROOT_CTOR = [HealthCheck];

export default class Frontend {
  public readonly dataSource: DataSource;
  public readonly options: FrontendOptions;
  public readonly routes: BaseRoute[] = [];
  public readonly services: Record<string, never>;

  private readonly app = new Koa();
  private status: 'waiting' | 'running' | 'done' = 'waiting';

  /**
   * Native request handler.
   * Can be used directly with express.js or the NodeJS http module.
   * Other frameworks will require adapters.
   */
  get handler(): HttpCallback {
    return this.app.callback();
  }

  constructor(dataSource: DataSource, options: FrontendOptions) {
    this.dataSource = dataSource;
    this.options = options;
    this.services = {};
  }

  /**
   * Builds the underlying application from the datasource.
   * This method can only be called once.
   */
  async start(): Promise<void> {
    if (this.status !== 'waiting') {
      throw new Error('Frontend cannot be restarted.');
    }

    this.status = 'running';
    this.buildRoutes();

    const router = new Router({ prefix: this.options.prefix });
    router.use(cors({ credentials: true, maxAge: 24 * 3600 }));
    router.use(bodyParser());
    this.routes.forEach(route => route.setupPublicRoutes(router));
    this.routes.forEach(route => route.setupAuthentication(router));
    this.routes.forEach(route => route.setupPrivateRoutes(router));
    await Promise.all(this.routes.map(route => route.bootstrap()));

    this.app.use(router.routes());
  }

  /**
   * Tear down all routes (close open sockets, ...)
   */
  async stop(): Promise<void> {
    if (this.status !== 'running') {
      throw new Error('Frontend is not running.');
    }

    this.status = 'done';
    await Promise.all(this.routes.map(route => route.tearDown()));
  }

  private buildRoutes(): void {
    const { dataSource, options } = this;

    this.routes.push(...ROOT_CTOR.map(Route => new Route(this.services, dataSource, options)));
  }
}
