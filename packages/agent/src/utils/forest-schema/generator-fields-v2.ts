import {
  Collection,
  ColumnSchema,
  ColumnType,
  ManyToManySchema,
  ManyToOneSchema,
  OneToManySchema,
  OneToOneSchema,
} from '@forestadmin/datasource-toolkit';
import {
  ForestSchemaFieldV2,
  ForestSchemaRelationV2,
  ForestServerColumnType,
} from '@forestadmin/forestadmin-client';

import ColumnSchemaValidator from './column-schema-validator';
import FrontendValidationUtils from './validation';

export default class SchemaGeneratorFieldsV2 {
  static buildField(collection: Collection, name: string): ForestSchemaFieldV2 {
    const { type } = collection.schema.fields[name];

    const schema: ForestSchemaFieldV2 = SchemaGeneratorFieldsV2.buildColumnSchema(collection, name);

    return schema;
  }

  private static buildColumnSchema(collection: Collection, name: string): ForestSchemaFieldV2 {
    const column = collection.schema.fields[name] as ColumnSchema;
    ColumnSchemaValidator.validate(column, name);

    return {
      name,
      type: this.convertColumnType(column.columnType),
      isPrimaryKey: Boolean(column.isPrimaryKey),
      filterOperators: [...column.filterOperators],
      enumerations: [...(column.enumValues ?? [])].sort() ?? null,

      isWritable: !column.isReadOnly,
      isSortable: column.isSortable,
      prefillFormValue: column.defaultValue ?? null,
      validations: FrontendValidationUtils.convertValidationList(column),
    };
  }

  static buildRelation(collection: Collection, name: string): ForestSchemaRelationV2 {
    const schema = collection.schema.fields[name];

    if (schema.type === 'ManyToMany') {
      return SchemaGeneratorFieldsV2.buildManyToMany(collection, name);
    }

    if (schema.type === 'ManyToOne') {
      return SchemaGeneratorFieldsV2.buildManyToOne(collection, name);
    }

    if (schema.type === 'OneToMany') {
      return SchemaGeneratorFieldsV2.buildOneToMany(collection, name);
    }

    if (schema.type === 'OneToOne') {
      return SchemaGeneratorFieldsV2.buildOneToOne(collection, name);
    }
  }

  private static convertColumnType(type: ColumnType): ForestServerColumnType {
    if (typeof type === 'string') return type;

    if (Array.isArray(type)) {
      return [this.convertColumnType(type[0])];
    }

    return {
      fields: Object.entries(type).map(([key, subType]) => ({
        field: key,
        type: this.convertColumnType(subType),
      })),
    };
  }

  private static buildManyToMany(collection: Collection, name: string): ForestSchemaRelationV2 {
    const relation = collection.schema.fields[name] as ManyToManySchema;

    return {
      name,
      type: 'ManyToMany',
      foreignCollection: relation.foreignCollection,
      throughCollection: relation.throughCollection,
      originKey: relation.originKey,
      originKeyTarget: relation.originKeyTarget,
      foreignKey: relation.foreignKey,
      foreignKeyTarget: relation.foreignKeyTarget,
    };
  }

  private static buildManyToOne(collection: Collection, name: string): ForestSchemaRelationV2 {
    const relation = collection.schema.fields[name] as ManyToOneSchema;

    return {
      name,
      type: 'ManyToOne',
      foreignCollection: relation.foreignCollection,
      foreignKey: relation.foreignKey,
      foreignKeyTarget: relation.foreignKeyTarget,
    };
  }

  private static buildOneToOne(collection: Collection, name: string): ForestSchemaRelationV2 {
    const relation = collection.schema.fields[name] as OneToOneSchema;

    return {
      name,
      type: 'OneToOne',
      foreignCollection: relation.foreignCollection,
      originKey: relation.originKey,
      originKeyTarget: relation.originKeyTarget,
    };
  }

  private static buildOneToMany(collection: Collection, name: string): ForestSchemaRelationV2 {
    const relation = collection.schema.fields[name] as OneToManySchema;

    return {
      name,
      type: 'OneToMany',
      foreignCollection: relation.foreignCollection,
      originKey: relation.originKey,
      originKeyTarget: relation.originKeyTarget,
    };
  }
}
