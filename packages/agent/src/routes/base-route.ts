import Router from '@koa/router';

import { ForestAdminHttpDriverOptionsWithDefaults } from '../types';
import { ForestAdminHttpDriverServices } from '../services';

export default abstract class BaseRoute {
  protected readonly services: ForestAdminHttpDriverServices;
  protected readonly options: ForestAdminHttpDriverOptionsWithDefaults;

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
