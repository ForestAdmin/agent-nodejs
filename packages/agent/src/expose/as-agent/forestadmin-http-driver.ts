import { DataSource } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import cors from '@koa/cors';

import { AgentOptionsWithDefaults } from './types';
import ForestHttpApi from './utils/forest-http-api';
import SchemaEmitter from './utils/forest-schema/emitter';
import makeRoutes from './routes';
import makeServices from './services';

export default class ForestAdminHttpDriver {
  public readonly dataSource: DataSource;
  public readonly options: AgentOptionsWithDefaults;

  constructor(dataSource: DataSource, options: AgentOptionsWithDefaults) {
    this.dataSource = dataSource;
    this.options = options;
  }

  async getRouter(): Promise<Router> {
    // Bootstrap app
    const services = makeServices(this.options);
    const routes = makeRoutes(this.dataSource, this.options, services);
    await Promise.all(routes.map(route => route.bootstrap()));

    // Build router
    const router = new Router();
    router.all('(.*)', cors({ credentials: true, maxAge: 24 * 3600, privateNetworkAccess: true }));
    router.use(bodyParser({ jsonLimit: '50mb' }));
    routes.forEach(route => route.setupRoutes(router));

    return router;
  }

  async sendSchema(): Promise<void> {
    const schema = await SchemaEmitter.getSerializedSchema(this.options, this.dataSource);
    const schemaIsKnown = await ForestHttpApi.hasSchema(this.options, schema.meta.schemaFileHash);

    if (!schemaIsKnown) {
      this.options.logger('Info', 'Schema was updated, sending new version');
      await ForestHttpApi.uploadSchema(this.options, schema);
    } else {
      this.options.logger('Info', 'Schema was not updated since last run');
    }
  }
}
