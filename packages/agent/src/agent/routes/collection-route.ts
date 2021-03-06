import { Collection, DataSource } from '@forestadmin/datasource-toolkit';

import { AgentOptionsWithDefaults, RouteType } from '../types';
import { ForestAdminHttpDriverServices } from '../services';
import BaseRoute from './base-route';

export default abstract class CollectionRoute extends BaseRoute {
  type = RouteType.PrivateRoute;

  private readonly collectionName: string;
  protected readonly dataSource: DataSource;

  protected get collection(): Collection {
    return this.dataSource.getCollection(this.collectionName);
  }

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
    collectionName: string,
  ) {
    super(services, options);
    this.collectionName = collectionName;
    this.dataSource = dataSource;
  }
}
