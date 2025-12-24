import type { AgentOptionsWithDefaults } from '../../types';
import type { Collection } from '@forestadmin/datasource-toolkit';
import type {
  ForestServerAction,
  ForestServerCollection,
  ForestServerField,
  ForestServerSegment,
} from '@forestadmin/forestadmin-client';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

import SchemaGeneratorActions from './generator-actions';
import SchemaGeneratorFields from './generator-fields';
import SchemaGeneratorSegments from './generator-segments';

export default class SchemaGeneratorCollection {
  private readonly schemaGeneratorActions: SchemaGeneratorActions;

  constructor(options: AgentOptionsWithDefaults) {
    this.schemaGeneratorActions = new SchemaGeneratorActions(options);
  }

  /** Build forest-server schema for a collection */
  async buildSchema(collection: Collection): Promise<ForestServerCollection> {
    return {
      actions: await this.buildActions(collection),
      fields: SchemaGeneratorCollection.buildFields(collection),
      icon: null,
      integration: null,
      isReadOnly: Object.values(collection.schema.fields).every(
        field => field.type !== 'Column' || field.isReadOnly,
      ),
      isSearchable: collection.schema.searchable,
      isVirtual: false,
      name: collection.name,
      onlyForRelationships: false,
      paginationType: 'page',
      segments: SchemaGeneratorCollection.buildSegments(collection),
    };
  }

  private buildActions(collection: Collection): Promise<ForestServerAction[]> {
    return Promise.all(
      Object.keys(collection.schema.actions)
        .sort()
        .map(name => this.schemaGeneratorActions.buildSchema(collection, name)),
    );
  }

  private static buildFields(collection: Collection): ForestServerField[] {
    // Do not export foreign keys as those will be edited using the many to one relationship.
    // Note that we always keep primary keys as not having them breaks reference fields in the UI.
    return Object.keys(collection.schema.fields)
      .filter(
        name =>
          SchemaUtils.isPrimaryKey(collection.schema, name) ||
          !SchemaUtils.isForeignKey(collection.schema, name),
      )
      .sort()
      .map(name => SchemaGeneratorFields.buildSchema(collection, name));
  }

  private static buildSegments(collection: Collection): ForestServerSegment[] {
    return collection.schema.segments
      .sort()
      .map(name => SchemaGeneratorSegments.buildSchema(collection, name));
  }
}
