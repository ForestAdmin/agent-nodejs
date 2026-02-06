import type { ForestAdminHttpDriverServices } from '../../services';
import type {
  AgentOptionsWithDefaults,
  CustomRouterCallback,
  CustomRouterOptions,
} from '../../types';
import type { DataSource } from '@forestadmin/datasource-toolkit';
import type Router from '@koa/router';

import KoaRouter from '@koa/router';

import { RouteType } from '../../types';
import BaseRoute from '../base-route';
import CustomRouterContextImpl from './custom-router-context';

export default class CustomRoute extends BaseRoute {
  private readonly dataSource: DataSource;
  private readonly callback: CustomRouterCallback;
  private readonly customOptions: Required<CustomRouterOptions>;

  get type(): RouteType {
    return this.customOptions.authenticated ? RouteType.CustomRoute : RouteType.PublicCustomRoute;
  }

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
    callback: CustomRouterCallback,
    customOptions?: CustomRouterOptions,
  ) {
    super(services, options);
    this.dataSource = dataSource;
    this.callback = callback;
    this.customOptions = {
      authenticated: customOptions?.authenticated ?? true,
      prefix: customOptions?.prefix ?? '',
    };
  }

  setupRoutes(router: Router): void {
    const context = new CustomRouterContextImpl(this.dataSource, this.services, this.options);
    const customRouter = new KoaRouter({ prefix: this.customOptions.prefix || undefined });

    this.callback(customRouter, context);

    router.use(customRouter.routes());
    router.use(customRouter.allowedMethods());
  }
}
