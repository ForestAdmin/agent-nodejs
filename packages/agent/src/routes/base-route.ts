import { DataSource } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { ForestAdminHttpDriverOptions, ForestAdminHttpDriverServices } from '../types';

export default abstract class BaseRoute {
  protected readonly services: ForestAdminHttpDriverServices;
  protected readonly dataSource: DataSource;
  protected readonly options: ForestAdminHttpDriverOptions;

  constructor(
    services: ForestAdminHttpDriverServices,
    dataSource: DataSource,
    options: ForestAdminHttpDriverOptions,
  ) {
    this.services = services;
    this.dataSource = dataSource;
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
