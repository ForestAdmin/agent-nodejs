import { DataSource } from '@forestadmin/datasource-toolkit';
import { ForestAdminHttpDriverServices } from '../services';
import { ForestAdminHttpDriverOptions } from '../types';
import CollectionRoute from './collection-base-route';

export default abstract class RelationRoute extends CollectionRoute {
  protected readonly relationName: string;

  constructor(
    services: ForestAdminHttpDriverServices,
    options: ForestAdminHttpDriverOptions,
    dataSource: DataSource,
    collectionName: string,
    relationName: string,
  ) {
    super(services, options, dataSource, collectionName);
    this.relationName = relationName;
  }
}
