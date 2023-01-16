import { Collection, DataSource, RelationSchema } from '@forestadmin/datasource-toolkit';

import CollectionRoute from './collection-route';
import { ForestAdminHttpDriverServices } from '../services';
import { AgentOptionsWithDefaults } from '../types';

export default abstract class RelationRoute extends CollectionRoute {
  protected readonly relationName: string;

  protected get foreignCollection(): Collection {
    const schema = this.collection.schema.fields[this.relationName] as RelationSchema;

    return this.collection.dataSource.getCollection(schema.foreignCollection);
  }

  constructor(
    services: ForestAdminHttpDriverServices,
    options: AgentOptionsWithDefaults,
    dataSource: DataSource,
    collectionName: string,
    relationName: string,
  ) {
    super(services, options, dataSource, collectionName);
    this.relationName = relationName;
  }
}
