import Router from '@koa/router';

import { ForestAdminHttpDriverOptionsWithDefaults, RouteType } from '../types';
import { ForestAdminHttpDriverServices } from '../services';

export default abstract class BaseRoute {
  protected readonly services: ForestAdminHttpDriverServices;
  protected readonly options: ForestAdminHttpDriverOptionsWithDefaults;

  abstract get type(): RouteType;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: ForestAdminHttpDriverOptionsWithDefaults,
  ) {
    this.services = services;
    this.options = options;
  }

  async bootstrap(): Promise<void> {
    // Do nothing by default
  }

  async tearDown(): Promise<void> {
    // Do nothing by default
  }

  abstract setupRoutes(router: Router): void;
}
