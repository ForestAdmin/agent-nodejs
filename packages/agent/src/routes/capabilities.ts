import { DataSource } from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';

import BaseRoute from './base-route';
import { ForestAdminHttpDriverServices } from '../services';
import { AgentOptionsWithDefaults, HttpCode, RouteType } from '../types';

export default class Capabilities extends BaseRoute {
  readonly type = RouteType.PrivateRoute;
  protected readonly dataSource: DataSource;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
  ) {
    super(services, options);
    this.dataSource = dataSource;
  }

  setupRoutes(router: Router): void {
    router.post(`/_internal/capabilities`, this.fetchCapabilities.bind(this));
  }

  private async fetchCapabilities(context: Context) {
    const collections = this.dataSource.collections.filter(collection =>
      (context.request.body as { collectionNames: string[] }).collectionNames?.includes(
        collection.name,
      ),
    );

    context.response.body = {
      nativeQueryConnections: Object.keys(this.dataSource.nativeQueryConnections).map(
        connectionName => ({ name: connectionName }),
      ),
      agentCapabilities: {
        canUseProjectionOnGetOne: true,
      },
      collections: collections?.map(collection => collection.capabilities) ?? [],
    };
    context.response.status = HttpCode.Ok;
  }
}
