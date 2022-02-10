import {
  Collection,
  CollectionUtils,
  ColumnSchema,
  ColumnType,
  FieldTypes,
  Operator,
  RelationSchema,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import FrontendFilterableUtils from './filterable';
import { ForestServerField } from './types';
import FrontendValidationUtils from './validation';

export default class SchemaGeneratorFields {
  private static relationMap: Partial<Record<FieldTypes, ForestServerField['relationship']>> = {
    [FieldTypes.ManyToMany]: 'BelongsToMany',
    [FieldTypes.ManyToOne]: 'BelongsTo',
    [FieldTypes.OneToMany]: 'HasMany',
    [FieldTypes.OneToOne]: 'HasOne',
  };

  static buildSchema(collection: Collection, name: string): ForestServerField {
    const { type } = collection.schema.fields[name];

    switch (type) {
      case FieldTypes.Column:
        return SchemaGeneratorFields.buildColumnSchema(collection, name);

      case FieldTypes.ManyToOne:
      case FieldTypes.OneToMany:
      case FieldTypes.ManyToMany:
      case FieldTypes.OneToOne:
        return SchemaGeneratorFields.buildRelationSchema(collection, name);

      default:
        throw new Error('Invalid field type');
    }
  }

  private static buildColumnSchema(collection: Collection, name: string): ForestServerField {
    const column = collection.schema.fields[name] as ColumnSchema;

    return {
      defaultValue: column.defaultValue ?? null,
      enums: column.enumValues ?? null,
      field: name,
      integration: null,
      inverseOf: null,
      isFilterable: FrontendFilterableUtils.isFilterable(column.columnType, column.filterOperators),
      isPrimaryKey: Boolean(column.isPrimaryKey),
      isReadOnly: Boolean(column.isReadOnly),
      isRequired: column.validation?.some(v => v.operator === Operator.Present) ?? false,
      isSortable: Boolean(column.isSortable),
      isVirtual: false,
      reference: null,
      type: column.columnType,
      validations: FrontendValidationUtils.convertValidationList(column.validation),
    };
  }

  private static buildRelationSchema(collection: Collection, name: string): ForestServerField {
    const relation = collection.schema.fields[name] as RelationSchema;
    const foreignCollection = collection.dataSource.getCollection(relation.foreignCollection);
    const [primaryKey] = SchemaUtils.getPrimaryKeys(foreignCollection.schema);
    const primaryKeySchema = foreignCollection.schema.fields[primaryKey] as ColumnSchema;

    return {
      defaultValue: null,
      enums: null,
      field: name,
      integration: null,
      inverseOf: CollectionUtils.getInverseRelation(collection, name),
      isFilterable: false,
      isPrimaryKey: false,
      isReadOnly: false,
      isRequired: false,
      isSortable: false,
      isVirtual: false,
      reference: `${foreignCollection.name}.${primaryKey}`,
      relationship: SchemaGeneratorFields.relationMap[relation.type],
      type: (relation.type === FieldTypes.OneToOne || relation.type === FieldTypes.ManyToOne
        ? primaryKeySchema.columnType
        : [primaryKeySchema.columnType]) as ColumnType,
      validations: [],
    };
  }
}
