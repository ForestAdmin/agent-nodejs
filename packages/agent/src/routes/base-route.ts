import type { ForestAdminHttpDriverServices } from '../services';
import type { AgentOptionsWithDefaults, RouteType } from '../types';
import type Router from '@koa/router';

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

  protected escapeUrlSlug(name: string): string {
    return encodeURI(name).replace(/([+?*])/g, '\\$1');
  }
}
