import { Collection, FieldTypes, SchemaUtils } from '@forestadmin/datasource-toolkit';
import SchemaGeneratorActions from './generator-actions';
import SchemaGeneratorFields from './generator-fields';
import SchemaGeneratorSegments from './generator-segments';
import { ForestServerCollection } from './types';

export default class SchemaGeneratorCollection {
  /** Build forest-server schema for a collection */
  static async buildSchema(
    prefix: string,
    collection: Collection,
  ): Promise<ForestServerCollection> {
    return {
      actions: await Promise.all(
        Object.keys(collection.schema.actions).map(name =>
          SchemaGeneratorActions.buildSchema(prefix, collection, name),
        ),
      ),
      fields: Object.keys(collection.schema.fields)
        .filter(name => !SchemaUtils.isSolelyForeignKey(collection.schema, name))
        .map(name => SchemaGeneratorFields.buildSchema(collection, name)),
      icon: null,
      integration: null,
      isReadOnly: Object.values(collection.schema.fields).every(
        field => field.type === FieldTypes.Column && field.isReadOnly,
      ),
      isSearchable: collection.schema.searchable,
      isVirtual: false,
      name: collection.name,
      nameOld: collection.name,
      onlyForRelationships: false,
      paginationType: 'page',
      segments: collection.schema.segments.map(name =>
        SchemaGeneratorSegments.buildSchema(collection, name),
      ),
    };
  }
}
