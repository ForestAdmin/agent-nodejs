import {
  Collection,
  CollectionUtils,
  ColumnSchema,
  FieldTypes,
  RelationSchema,
} from '@forestadmin/datasource-toolkit';
import { ForestServerField } from './types';
import FrontendFilterableUtils from './filterable';
import FrontendValidationUtils from './validation';

export default class SchemaGeneratorFields {
  private static relationMap: Partial<Record<FieldTypes, ForestServerField['relationship']>> = {
    ManyToMany: 'BelongsToMany',
    ManyToOne: 'BelongsTo',
    OneToMany: 'HasMany',
    OneToOne: 'HasOne',
  };

  static buildSchema(collection: Collection, name: string): ForestServerField {
    const { type } = collection.schema.fields[name];

    let schema: ForestServerField;

    switch (type) {
      case 'Column':
        schema = SchemaGeneratorFields.buildColumnSchema(collection, name);
        break;

      case 'ManyToOne':
      case 'OneToMany':
      case 'ManyToMany':
      case 'OneToOne':
        schema = SchemaGeneratorFields.buildRelationSchema(collection, name);
        break;

      default:
        throw new Error('Invalid field type');
    }

    return Object.entries(schema)
      .sort()
      .reduce((sortedSchema, [key, value]) => {
        sortedSchema[key] = value;

        return sortedSchema;
      }, {});
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
      isRequired: column.validation?.some(v => v.operator === 'Present') ?? false,
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

    const relationSchema = {
      field: name,
      enums: null,
      integration: null,
      isReadOnly: false,
      isVirtual: false,
      inverseOf: CollectionUtils.getInverseRelation(collection, name),
      relationship: SchemaGeneratorFields.relationMap[relation.type],
    };

    if (relation.type === 'ManyToMany' || relation.type === 'OneToMany') {
      const key =
        relation.type === 'OneToMany' ? relation.originKeyTarget : relation.foreignKeyTarget;
      const keySchema = foreignCollection.schema.fields[key] as ColumnSchema;

      return {
        type: [keySchema.columnType],
        defaultValue: null,
        isFilterable: false,
        isPrimaryKey: false,
        isRequired: false,
        isSortable: false,
        validations: [],
        reference: `${foreignCollection.name}.${key}`,
        ...relationSchema,
      };
    }

    const isFilterable = Object.values(foreignCollection.schema.fields).some(
      field =>
        field.type === 'Column' &&
        FrontendFilterableUtils.isFilterable(field.columnType, field.filterOperators),
    );

    if (relation.type === 'OneToOne') {
      const key = relation.originKeyTarget;
      const keySchema = foreignCollection.schema.fields[key] as ColumnSchema;

      return {
        type: keySchema.columnType,
        defaultValue: null,
        isFilterable,
        isPrimaryKey: false,
        isRequired: false,
        isSortable: Boolean(keySchema.isSortable),
        validations: [],
        reference: `${foreignCollection.name}.${key}`,
        ...relationSchema,
      };
    }

    const key = relation.foreignKey;
    const keySchema = collection.schema.fields[key] as ColumnSchema;

    return {
      type: keySchema.columnType,
      defaultValue: keySchema.defaultValue ?? null,
      isFilterable,
      isPrimaryKey: Boolean(keySchema.isPrimaryKey),
      isRequired: keySchema.validation?.some(v => v.operator === 'Present') ?? false,
      isSortable: Boolean(keySchema.isSortable),
      validations: FrontendValidationUtils.convertValidationList(keySchema.validation),
      reference: `${foreignCollection.name}.${relation.foreignKeyTarget}`,
      ...relationSchema,
    };
  }
}
