import { DataSource } from '@forestadmin/datasource-toolkit';
import cors from '@koa/cors';
import Router from '@koa/router';
import { IncomingMessage, ServerResponse } from 'http';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import path from 'path';
import AllRoutes from './routes';
import BaseRoute from './routes/base-route';
import makeServices, { ForestAdminHttpDriverServices } from './services';
import { ForestAdminHttpDriverOptions } from './types';
import SchemaEmitter from './utils/forest-schema/emitter';

/** Native NodeJS callback that can be passed to an HTTP Server */
export type HttpCallback = (req: IncomingMessage, res: ServerResponse) => void;

export default class ForestAdminHttpDriver {
  public readonly dataSource: DataSource;
  public readonly options: ForestAdminHttpDriverOptions;
  public readonly routes: BaseRoute[] = [];
  public readonly services: ForestAdminHttpDriverServices;

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

  constructor(dataSource: DataSource, options: ForestAdminHttpDriverOptions) {
    this.dataSource = dataSource;
    this.options = options;
    this.services = makeServices(options);
  }

  /**
   * Builds the underlying application from the datasource.
   * This method can only be called once.
   */
  async start(): Promise<void> {
    if (this.status !== 'waiting') {
      throw new Error('Agent cannot be restarted.');
    }

    this.status = 'running';

    // Build http application
    const router = new Router({ prefix: path.join('/', this.options.prefix) });
    this.buildRoutes();

    this.routes.forEach(route => route.setupPublicRoutes(router));
    this.routes.forEach(route => route.setupAuthentication(router));
    this.routes.forEach(route => route.setupPrivateRoutes(router));
    await Promise.all(this.routes.map(route => route.bootstrap()));

    this.app.use(cors({ credentials: true, maxAge: 24 * 3600 })).use(bodyParser());
    this.app.use(router.routes());

    // Send schema to forestadmin-server (if relevant).
    const schema = await SchemaEmitter.getSerializedSchema(this.options, this.dataSource);
    const schemaIsKnown = await this.services.forestHTTPApi.hasSchema(schema.meta.schemaFileHash);

    if (!schemaIsKnown) {
      await this.services.forestHTTPApi.uploadSchema(schema);
    }
  }

  /**
   * Tear down all routes (close open sockets, ...)
   */
  async stop(): Promise<void> {
    if (this.status !== 'running') {
      throw new Error('Agent is not running.');
    }

    this.status = 'done';
    await Promise.all(this.routes.map(route => route.tearDown()));
  }

  private buildRoutes(): void {
    const { dataSource, options } = this;

    this.routes.push(...AllRoutes.map(Route => new Route(this.services, dataSource, options)));
  }
}
