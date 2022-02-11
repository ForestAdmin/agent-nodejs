import { Collection, DataSource, RelationSchema } from '@forestadmin/datasource-toolkit';
import { ForestAdminHttpDriverOptionsWithDefaults } from '../types';
import { ForestAdminHttpDriverServices } from '../services';
import CollectionRoute from './collection-base-route';

export default abstract class RelationRoute extends CollectionRoute {
  protected readonly relationName: string;

  protected get foreignCollection(): Collection {
    const schema = this.collection.schema.fields[this.relationName] as RelationSchema;

    return this.collection.dataSource.getCollection(schema.foreignCollection);
  }

  constructor(
    services: ForestAdminHttpDriverServices,
    options: ForestAdminHttpDriverOptionsWithDefaults,
    dataSource: DataSource,
    collectionName: string,
    relationName: string,
  ) {
    super(services, options, dataSource, collectionName);
    this.relationName = relationName;
  }
}
