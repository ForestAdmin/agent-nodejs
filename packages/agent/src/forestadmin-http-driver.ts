import { DataSource, ValidationError } from '@forestadmin/datasource-toolkit';
import { IncomingMessage, ServerResponse } from 'http';
import Koa, { Context, HttpError, Next } from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import path from 'path';

import {
  ForestAdminHttpDriverOptions,
  ForestAdminHttpDriverOptionsWithDefaults,
  HttpCode,
  LoggerLevel,
} from './types';
import BaseRoute from './routes/base-route';
import ForestHttpApi from './utils/forest-http-api';
import OptionsUtils from './utils/http-driver-options';
import SchemaEmitter from './utils/forest-schema/emitter';
import makeRoutes from './routes';
import makeServices, { ForestAdminHttpDriverServices } from './services';

/** Native NodeJS callback that can be passed to an HTTP Server */
export type HttpCallback = (req: IncomingMessage, res: ServerResponse) => void;

export default class ForestAdminHttpDriver {
  public readonly dataSources: DataSource[];
  public readonly options: ForestAdminHttpDriverOptionsWithDefaults;
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

  constructor(dataSource: DataSource | DataSource[], options: ForestAdminHttpDriverOptions) {
    this.dataSources = Array.isArray(dataSource) ? dataSource : [dataSource];
    this.options = OptionsUtils.withDefaults(options);
    this.services = makeServices(this.options);
    this.routes = makeRoutes(this.dataSources, this.options, this.services);

    OptionsUtils.validate(this.options);
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

    this.routes.forEach(route => route.setupPublicRoutes(router));
    this.routes.forEach(route => route.setupAuthentication(router));
    this.routes.forEach(route => route.setupPrivateRoutes(router));
    await Promise.all(this.routes.map(route => route.bootstrap()));

    this.app
      .use(this.logger.bind(this))
      .use(this.errorHandler.bind(this))
      .use(cors({ credentials: true, maxAge: 24 * 3600 }))
      .use(bodyParser())
      .use(router.routes());

    // Send schema to forestadmin-server (if relevant).
    const schema = await SchemaEmitter.getSerializedSchema(this.options, this.dataSources);
    const schemaIsKnown = await ForestHttpApi.hasSchema(this.options, schema.meta.schemaFileHash);

    if (!schemaIsKnown) {
      await ForestHttpApi.uploadSchema(this.options, schema);
    }

    this.options?.logger(LoggerLevel.Info, 'Started');
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

  /* istanbul ignore next */
  private async errorHandler(context: Context, next: Next): Promise<void> {
    const { request, response } = context;

    try {
      await next();
    } catch (e) {
      if (!this.options.isProduction) {
        const query = JSON.stringify(request.query, null, ' ').replace(/"/g, '');
        console.error('');
        console.error(`\x1b[33m===== An exception was raised =====\x1b[0m`);
        console.error(`${request.method} \x1b[34m${request.path}\x1b[36m?${query}\x1b[0m`);
        console.error('');
        console.error(e.stack);
        console.error(`\x1b[33m===================================\x1b[0m`);
        console.error('');
      }

      if (e instanceof HttpError) {
        response.status = e.status;
        response.body = { message: e.message };
      } else if (e instanceof ValidationError) {
        response.status = HttpCode.BadRequest;
        response.body = { message: e.message };
      } else {
        response.status = HttpCode.InternalServerError;
        response.body = { message: 'Unexpected error' };
      }
    }
  }

  /* istanbul ignore next */
  private async logger(context: Context, next: Next): Promise<void> {
    const timer = Date.now();

    try {
      await next();
    } finally {
      let message = `${context.request.method} ${context.request.path}`;
      message += ` - ${context.response.status}`;
      message += ` - ${Date.now() - timer}ms`;
      if (context.state.user) message += ` - ${context.state.user.email}`;

      this.options?.logger(
        context.response.status >= HttpCode.BadRequest ? LoggerLevel.Warn : LoggerLevel.Info,
        message,
      );
    }
  }
}
