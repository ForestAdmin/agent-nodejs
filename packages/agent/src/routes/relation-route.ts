import { DataSource } from '@forestadmin/datasource-toolkit';
import { ForestAdminHttpDriverServices } from '../services';
import { ForestAdminHttpDriverOptions } from '../types';
import CollectionRoute from './collection-base-route';

export default abstract class RelationRoute extends CollectionRoute {
  protected readonly relationName: string;

  constructor(
    services: ForestAdminHttpDriverServices,
    dataSource: DataSource,
    options: ForestAdminHttpDriverOptions,
    collectionName: string,
    relationName: string,
  ) {
    super(services, dataSource, options, collectionName);
    this.relationName = relationName;
  }
}
