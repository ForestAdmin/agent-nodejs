import { DataSource, LoggerLevel } from '@forestadmin/datasource-toolkit';
import { IncomingMessage, ServerResponse } from 'http';
import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';
import path from 'path';

import { AgentOptions } from '../types';
import { AgentOptionsWithDefaults } from './types';
import BaseRoute from './routes/base-route';
import ForestHttpApi from './utils/forest-http-api';
import OptionsUtils from './utils/http-driver-options';
import SchemaEmitter from './utils/forest-schema/emitter';
import makeRoutes from './routes';
import makeServices, { ForestAdminHttpDriverServices } from './services';

/** Native Node.js callback that can be passed to an HTTP Server */
export type HttpCallback = (req: IncomingMessage, res: ServerResponse) => void;

export default class ForestAdminHttpDriver {
  public readonly dataSource: DataSource;
  public readonly options: AgentOptionsWithDefaults;
  public readonly services: ForestAdminHttpDriverServices;
  public routes: BaseRoute[] = [];

  private readonly app = new Koa();
  private status: 'waiting' | 'running' | 'done' = 'waiting';

  /**
   * Native request handler.
   * Can be used directly with express.js or the Node.js http module.
   * Other frameworks will require adapters.
   */
  get handler(): HttpCallback {
    return this.app.callback();
  }

  constructor(dataSource: DataSource, options: AgentOptions) {
    this.dataSource = dataSource;
    this.options = OptionsUtils.withDefaults(options);
    this.services = makeServices(this.options);

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
    this.routes = makeRoutes(this.dataSource, this.options, this.services);
    this.routes.forEach(route => route.setupRoutes(router));
    await Promise.all(this.routes.map(route => route.bootstrap()));

    this.app
      .use(cors({ credentials: true, maxAge: 24 * 3600 }))
      .use(bodyParser({ jsonLimit: '50mb' }))
      .use(router.routes());

    // Send schema to forestadmin-server (if relevant).
    const schema = await SchemaEmitter.getSerializedSchema(this.options, this.dataSource);
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
}
