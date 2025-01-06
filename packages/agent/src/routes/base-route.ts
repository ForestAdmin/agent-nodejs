import Router from '@koa/router';

import { ForestAdminHttpDriverServices } from '../services';
import { AgentOptionsWithDefaults, RouteType } from '../types';

export default abstract class BaseRoute {
  protected readonly services: ForestAdminHttpDriverServices;
  protected readonly options: AgentOptionsWithDefaults;

  constructor(services: ForestAdminHttpDriverServices, options: AgentOptionsWithDefaults) {
    this.services = services;
    this.options = options;
  }
  abstract get type(): RouteType;

  async bootstrap(): Promise<void> {
    // Do nothing by default
  }

  abstract setupRoutes(router: Router): void;

  protected escapeUrlSlug(name: string): string {
    return encodeURI(name).replace(/([+?*])/g, '\\$1');
  }
}
