import Router from '@koa/router';

import { AgentOptionsWithDefaults, RouteType } from '../types';
import { ForestAdminHttpDriverServices } from '../services';

export default abstract class BaseRoute {
  protected readonly services: ForestAdminHttpDriverServices;
  protected readonly options: AgentOptionsWithDefaults;

  abstract get type(): RouteType;

  constructor(services: ForestAdminHttpDriverServices, options: AgentOptionsWithDefaults) {
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
