import { Collection, DataSource } from '@forestadmin/datasource-toolkit';
import { ForestAdminHttpDriverOptions } from '../types';
import { ForestAdminHttpDriverServices } from '../services';
import BaseRoute from './base-route';

export default abstract class CollectionRoute extends BaseRoute {
  private readonly collectionName: string;
  protected readonly dataSource: DataSource;

  protected get collection(): Collection {
    return this.dataSource.getCollection(this.collectionName);
  }

  constructor(
    services: ForestAdminHttpDriverServices,
    dataSource: DataSource,
    options: ForestAdminHttpDriverOptions,
    collectionName: string,
  ) {
    super(services, options);
    this.collectionName = collectionName;
    this.dataSource = dataSource;
  }
}
