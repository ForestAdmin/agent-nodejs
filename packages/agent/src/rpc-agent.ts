/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataSourceCustomizer, TSchema } from '@forestadmin/datasource-customizer';
import { DataSource } from '@forestadmin/datasource-toolkit';
import cors from '@koa/cors';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';

import Agent from './agent';
import { makeRpcRoutes } from './routes';
import makeServices from './services';

export default class RpcAgent<S extends TSchema = TSchema> extends Agent<S> {
  /**
   * Create an http handler which can respond to all queries which are expected from an agent.
   */
  protected override async getRouter(dataSource: DataSource): Promise<Router> {
    // Bootstrap app
    const services = makeServices(this.options);
    const routes = makeRpcRoutes(dataSource, this.options, services);
    await Promise.all(routes.map(route => route.bootstrap()));

    // Build router
    const router = new Router();
    router.all('(.*)', cors({ credentials: true, maxAge: 24 * 3600, privateNetworkAccess: true }));
    router.use(bodyParser({ jsonLimit: this.options.maxBodySize }));
    routes.forEach(route => route.setupRoutes(router));

    return router;
  }

  protected override async buildRouterAndSendSchema(): Promise<Router> {
    const { isProduction, logger, typingsPath, typingsMaxDepth } = this.options;

    // It allows to rebuild the full customization stack with no code customizations
    this.nocodeCustomizer = new DataSourceCustomizer<S>();
    this.nocodeCustomizer.addDataSource(this.customizer.getFactory());
    this.nocodeCustomizer.use(this.customizationService.addCustomizations);

    const dataSource = await this.nocodeCustomizer.getDataSource(logger);

    logger('Info', 'Started as RPC agent, schema not sended.');

    const [router] = await Promise.all([
      this.getRouter(dataSource),
      !isProduction && typingsPath
        ? this.customizer.updateTypesOnFileSystem(typingsPath, typingsMaxDepth, logger)
        : Promise.resolve(),
    ]);

    return router;
  }
}
