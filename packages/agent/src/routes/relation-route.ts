import { Collection, DataSource, SchemaUtils } from '@forestadmin/datasource-toolkit';

import CollectionRoute from './collection-route';
import { ForestAdminHttpDriverServices } from '../services';
import { AgentOptionsWithDefaults } from '../types';

export default abstract class RelationRoute extends CollectionRoute {
  protected readonly relationName: string;

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

  protected get foreignCollection(): Collection {
    const schema = SchemaUtils.getRelation(
      this.collection.schema,
      this.relationName,
      this.collection.name,
    );

    return this.collection.dataSource.getCollection(schema.foreignCollection);
  }

  protected get relationUrlSlug(): string {
    return this.escapeUrlSlug(this.relationName);
  }
}
