import { Collection } from '@forestadmin/datasource-toolkit';

import SchemaGeneratorActions from './generator-actions';
import SchemaGeneratorFields from './generator-fields';
import SchemaGeneratorSegments from './generator-segments';
import {
  ForestServerAction,
  ForestServerCollection,
  ForestServerField,
  ForestServerSegment,
} from './types';

export default class SchemaGeneratorCollection {
  /** Build forest-server schema for a collection */
  static async buildSchema(collection: Collection): Promise<ForestServerCollection> {
    return {
      actions: await this.buildActions(collection),
      fields: this.buildFields(collection),
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
      segments: this.buildSegments(collection),
    };
  }

  private static buildActions(collection: Collection): Promise<ForestServerAction[]> {
    return Promise.all(
      Object.keys(collection.schema.actions)
        .sort()
        .map(name => SchemaGeneratorActions.buildSchema(collection, name)),
    );
  }

  private static buildFields(collection: Collection): ForestServerField[] {
    // Do not export foreign keys as those will be edited using the many to one relationship.
    // Note that we always keep primary keys as not having them breaks reference fields in the UI.
    return Object.keys(collection.schema.fields)
      .filter(name => collection.schema.isPrimaryKey(name) || !collection.schema.isForeignKey(name))
      .sort()
      .map(name => SchemaGeneratorFields.buildSchema(collection, name));
  }

  private static buildSegments(collection: Collection): ForestServerSegment[] {
    return collection.schema.segments
      .sort()
      .map(name => SchemaGeneratorSegments.buildSchema(collection, name));
  }
}
