import {
  Collection,
  CollectionUtils,
  ColumnSchema,
  ColumnType,
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

    switch (type) {
      case 'Column':
        return SchemaGeneratorFields.buildColumnSchema(collection, name);

      case 'ManyToOne':
      case 'OneToMany':
      case 'ManyToMany':
      case 'OneToOne':
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
    const primaryKeySchema = foreignCollection.schema.fields[primaryKey] as ColumnSchema;

    // Not sure what is meant by knowing if a relation is filterable or not.
    // => let's say that the relation is filterable if at least one field in the target can
    // be filtered for many to one / one to one.
    const isFilterable =
      (relation.type === 'ManyToOne' || relation.type === 'OneToOne') &&
      Object.values(foreignCollection.schema.fields).some(
        field =>
          field.type === 'Column' &&
          FrontendFilterableUtils.isFilterable(field.columnType, field.filterOperators),
      );

    return {
      defaultValue: null,
      enums: null,
      field: name,
      integration: null,
      inverseOf: CollectionUtils.getInverseRelation(collection, name),
      isFilterable,
      isPrimaryKey: false,
      isReadOnly: false,
      isRequired: false, // @fixme for many to one / one to one we need to check the fk
      isSortable: false,
      isVirtual: false,
      reference: `${foreignCollection.name}.${primaryKey}`,
      relationship: SchemaGeneratorFields.relationMap[relation.type],
      type: (relation.type === 'OneToOne' || relation.type === 'ManyToOne'
        ? primaryKeySchema.columnType
        : [primaryKeySchema.columnType]) as ColumnType,
      validations: [],
    };
  }
}
