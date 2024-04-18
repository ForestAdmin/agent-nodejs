import { Collection, SchemaUtils } from '@forestadmin/datasource-toolkit';
import {
  ForestSchemaActionV2,
  ForestSchemaCollectionV2,
  ForestSchemaFieldV2,
  ForestSchemaRelationV2,
  ForestServerSegment,
} from '@forestadmin/forestadmin-client';

import SchemaGeneratorActionsV2 from './generator-actions-v2';
import SchemaGeneratorFieldsV2 from './generator-fields-v2';
import SchemaGeneratorSegments from './generator-segments';

export default class SchemaGeneratorCollectionV2 {
  /** Build forest-server schema for a collection */
  static async buildSchema(collection: Collection): Promise<ForestSchemaCollectionV2> {
    return {
      name: collection.name,
      fields: this.buildFields(collection),
      relations: this.buildRelations(collection),
      actions: await this.buildActions(collection),
      segments: this.buildSegments(collection),
      // capabilities
      canSearch: collection.schema.searchable,
      canList: collection.schema.listable,
      canCreate: collection.schema.creatable,
      canUpdate: collection.schema.updatable,
      canDelete: collection.schema.deletable,
      canCount: collection.schema.countable,
      canChart: collection.schema.chartable,
      canNativeQuery: collection.schema.support_native_query,
    };
  }

  private static buildActions(collection: Collection): Promise<ForestSchemaActionV2[]> {
    return Promise.all(
      Object.keys(collection.schema.actions)
        .sort()
        .map(name => SchemaGeneratorActionsV2.buildSchema(collection, name)),
    );
  }

  private static buildFields(collection: Collection): ForestSchemaFieldV2[] {
    return Object.keys(collection.schema.fields)
      .sort()
      .filter(item => collection.schema.fields[item].type === 'Column')
      .map(name => SchemaGeneratorFieldsV2.buildField(collection, name));
  }

  private static buildRelations(collection: Collection): ForestSchemaRelationV2[] {
    return Object.keys(collection.schema.fields)
      .sort()
      .filter(item => collection.schema.fields[item].type !== 'Column')
      .map(name => SchemaGeneratorFieldsV2.buildRelation(collection, name));
  }

  private static buildSegments(collection: Collection): ForestServerSegment[] {
    return collection.schema.segments
      .sort()
      .map(name => SchemaGeneratorSegments.buildSchema(collection, name));
  }
}
