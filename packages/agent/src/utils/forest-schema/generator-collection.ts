import { Collection, SchemaUtils } from '@forestadmin/datasource-toolkit';
import { ForestServerCollection } from './types';
import SchemaGeneratorActions from './generator-actions';
import SchemaGeneratorFields from './generator-fields';
import SchemaGeneratorSegments from './generator-segments';

export default class SchemaGeneratorCollection {
  /** Build forest-server schema for a collection */
  static async buildSchema(collection: Collection): Promise<ForestServerCollection> {
    return {
      actions: await Promise.all(
        Object.keys(collection.schema.actions)
          .sort()
          .map(name => SchemaGeneratorActions.buildSchema(collection, name)),
      ),
      fields: Object.keys(collection.schema.fields)
        // Do not export foreign keys as those will be edited using the many to one relationship.
        // Note that we always keep primary keys as not having them breaks reference fields in the
        // UI.
        .filter(
          name =>
            SchemaUtils.isPrimaryKey(collection.schema, name) ||
            !SchemaUtils.isForeignKey(collection.schema, name),
        )
        .sort()
        .map(name => SchemaGeneratorFields.buildSchema(collection, name)),
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
      segments: collection.schema.segments
        .sort()
        .map(name => SchemaGeneratorSegments.buildSchema(collection, name)),
    };
  }
}
