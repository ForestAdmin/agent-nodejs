import Router from '@koa/router';
import { ForestAdminHttpDriverServices } from '../services';
import { ForestAdminHttpDriverOptions } from '../types';

export default abstract class BaseRoute {
  protected readonly services: ForestAdminHttpDriverServices;
  protected readonly options: ForestAdminHttpDriverOptions;

  constructor(services: ForestAdminHttpDriverServices, options: ForestAdminHttpDriverOptions) {
    this.services = services;
    this.options = options;
  }

  async bootstrap(): Promise<void> {
    // Do nothing by default
  }

  async tearDown(): Promise<void> {
    // Do nothing by default
  }

  setupPublicRoutes(router: Router): void {
    void router;
  }

  setupAuthentication(router: Router): void {
    void router;
  }

  setupPrivateRoutes(router: Router): void {
    void router;
  }
}
