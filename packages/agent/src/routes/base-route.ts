import Router from '@koa/router';

import { ForestAdminHttpDriverServices } from '../services';
import { AgentOptionsWithDefaults, RouteType } from '../types';

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

  abstract setupRoutes(router: Router): void;
}
