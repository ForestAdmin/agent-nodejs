import {
  Collection,
  CollectionUtils,
  ColumnSchema,
  FieldTypes,
  RelationSchema,
  SchemaUtils,
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
    const [primaryKey] = SchemaUtils.getPrimaryKeys(foreignCollection.schema);

    const relationSchema = {
      field: name,
      inverseOf: CollectionUtils.getInverseRelation(collection, name),
      reference: `${foreignCollection.name}.${primaryKey}`,
      relationship: SchemaGeneratorFields.relationMap[relation.type],
    };

    if (relation.type === 'ManyToOne' || relation.type === 'OneToOne') {
      const columnSchema = SchemaGeneratorFields.buildColumnSchema(
        collection,
        relation.type === 'ManyToOne' ? relation.foreignKey : relation.originKeyTarget,
      );

      return {
        ...columnSchema,
        ...relationSchema,
      };
    }

    const primaryKeySchema = foreignCollection.schema.fields[primaryKey] as ColumnSchema;

    return {
      defaultValue: null,
      enums: null,
      integration: null,
      isFilterable: false,
      isPrimaryKey: false,
      isReadOnly: false,
      isRequired: false,
      isSortable: false,
      isVirtual: false,
      validations: [],
      type: [primaryKeySchema.columnType],
      ...relationSchema,
    };
  }
}
