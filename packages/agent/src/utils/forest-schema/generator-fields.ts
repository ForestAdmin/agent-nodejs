import {
  Collection,
  CollectionUtils,
  ColumnSchema,
  ColumnType,
  FieldTypes,
  ManyToManySchema,
  ManyToOneSchema,
  OneToManySchema,
  OneToOneSchema,
  PrimitiveTypes,
  RelationSchema,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import { ForestServerColumnType, ForestServerField } from './types';
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
    const isForeignKey = SchemaUtils.isForeignKey(collection.schema, name);

    return {
      defaultValue: column.defaultValue ?? null,
      enums: column.enumValues ?? null,
      field: name,
      integration: null,
      inverseOf: null,
      isFilterable: FrontendFilterableUtils.isFilterable(column.columnType, column.filterOperators),
      isPrimaryKey: Boolean(column.isPrimaryKey),

      // When a column is a foreign key, it is readonly.
      // This may sound counter-intuitive: it is so that the user don't have two fields which
      // allow updating the same foreign key in the detail-view form (fk + many to one)
      isReadOnly: isForeignKey || Boolean(column.isReadOnly),
      isRequired: column.validation?.some(v => v.operator === 'Present') ?? false,
      isSortable: Boolean(column.isSortable),
      isVirtual: false,
      reference: null,
      type: this.convertColumnType(column.columnType),
      validations: FrontendValidationUtils.convertValidationList(column.validation),
    };
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

  private static buildToManyRelationSchema(
    relation: OneToManySchema | ManyToManySchema,
    collection: Collection,
    foreignCollection: Collection,
    baseSchema: ForestServerField,
  ): ForestServerField {
    let targetName: string;
    let targetField: ColumnSchema;
    let isReadOnly: boolean;

    if (relation.type === 'OneToMany') {
      targetName = relation.originKeyTarget;
      targetField = collection.schema.fields[targetName] as ColumnSchema;

      const originKey = foreignCollection.schema.fields[relation.originKey] as ColumnSchema;
      isReadOnly = originKey.isReadOnly;
    } else {
      targetName = relation.foreignKeyTarget;
      targetField = foreignCollection.schema.fields[targetName] as ColumnSchema;

      const throughSchema = collection.dataSource.getCollection(relation.throughCollection).schema;
      const foreignKey = throughSchema.fields[relation.foreignKey] as ColumnSchema;
      const originKey = throughSchema.fields[relation.originKey] as ColumnSchema;
      isReadOnly = originKey.isReadOnly || foreignKey.isReadOnly;
    }

    return {
      ...baseSchema,
      type: [targetField.columnType as PrimitiveTypes],
      defaultValue: null,
      isFilterable: false,
      isPrimaryKey: false,
      isRequired: false,
      isReadOnly: Boolean(isReadOnly),
      isSortable: false,
      validations: [],
      reference: `${foreignCollection.name}.${targetName}`,
    };
  }

  private static isForeignCollectionFilterable(foreignCollection: Collection): boolean {
    return Object.values(foreignCollection.schema.fields).some(
      field =>
        field.type === 'Column' &&
        FrontendFilterableUtils.isFilterable(field.columnType, field.filterOperators),
    );
  }

  private static buildOneToOneSchema(
    relation: OneToOneSchema,
    collection: Collection,
    foreignCollection: Collection,
    baseSchema: ForestServerField,
  ): ForestServerField {
    const targetField = collection.schema.fields[relation.originKeyTarget] as ColumnSchema;
    const keyField = foreignCollection.schema.fields[relation.originKey] as ColumnSchema;

    return {
      ...baseSchema,
      type: keyField.columnType as PrimitiveTypes,
      defaultValue: null,
      isFilterable: SchemaGeneratorFields.isForeignCollectionFilterable(foreignCollection),
      isPrimaryKey: false,
      isRequired: false,
      isReadOnly: Boolean(keyField.isReadOnly),
      isSortable: Boolean(targetField.isSortable),
      validations: [],
      reference: `${foreignCollection.name}.${relation.originKeyTarget}`,
    };
  }

  private static buildManyToOneSchema(
    relation: ManyToOneSchema,
    collection: Collection,
    foreignCollection: Collection,
    baseSchema: ForestServerField,
  ): ForestServerField {
    const keyField = collection.schema.fields[relation.foreignKey] as ColumnSchema;

    return {
      ...baseSchema,
      type: keyField.columnType as PrimitiveTypes,
      defaultValue: keyField.defaultValue ?? null,
      isFilterable: SchemaGeneratorFields.isForeignCollectionFilterable(foreignCollection),

      // Always set false even if the foreign key is the primary key.
      // Doing otherwise breaks the frontend when no reference field is set.
      isPrimaryKey: false,
      isRequired: keyField.validation?.some(v => v.operator === 'Present') ?? false,
      isReadOnly: Boolean(keyField.isReadOnly),
      isSortable: Boolean(keyField.isSortable),
      validations: FrontendValidationUtils.convertValidationList(keyField.validation),
      reference: `${foreignCollection.name}.${relation.foreignKeyTarget}`,
    };
  }

  private static buildRelationSchema(collection: Collection, name: string): ForestServerField {
    const relation = collection.schema.fields[name] as RelationSchema;
    const foreignCollection = collection.dataSource.getCollection(relation.foreignCollection);

    const relationSchema = {
      field: name,
      enums: null,
      integration: null,
      isVirtual: false,
      inverseOf: CollectionUtils.getInverseRelation(collection, name),
      relationship: SchemaGeneratorFields.relationMap[relation.type],
    };

    switch (relation.type) {
      case 'ManyToMany':
      case 'OneToMany':
        return SchemaGeneratorFields.buildToManyRelationSchema(
          relation,
          collection,
          foreignCollection,
          relationSchema,
        );
      case 'OneToOne':
        return SchemaGeneratorFields.buildOneToOneSchema(
          relation,
          collection,
          foreignCollection,
          relationSchema,
        );
      default:
        return SchemaGeneratorFields.buildManyToOneSchema(
          relation,
          collection,
          foreignCollection,
          relationSchema,
        );
    }
  }
}
