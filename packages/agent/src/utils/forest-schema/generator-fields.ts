import {
  Collection,
  CollectionUtils,
  ColumnSchema,
  ColumnType,
  ManyToManySchema,
  ManyToOneSchema,
  OneToManySchema,
  OneToOneSchema,
  PrimitiveTypes,
  RelationSchema,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import { ForestServerColumnType, ForestServerField } from '@forestadmin/forestadmin-client';

import FrontendFilterableUtils from './filterable';
import FrontendValidationUtils from './validation';

// Building the schema is a bit complex so we split the code in several functions.
//
// Those types are used so that the compiler ensures that
// - We don't forget to set a property
// - We don't set the same property twice.
type PartialColumnOrRelation = Omit<ForestServerField, 'field' | 'integration' | 'isVirtual'>;
type PartialRelation = Omit<
  PartialColumnOrRelation,
  'enums' | 'inverseOf' | 'isFilterable' | 'isPrimaryKey' | 'isSortable'
>;

export default class SchemaGeneratorFields {
  static buildSchema(collection: Collection, name: string): ForestServerField {
    const { type } = collection.schema.fields[name];
    let schema: PartialColumnOrRelation;

    if (type === 'Column') {
      schema = this.buildColumnSchema(collection, name);
    } else if (['OneToOne', 'ManyToOne', 'OneToMany', 'ManyToMany'].includes(type)) {
      schema = this.buildRelationSchema(collection, name);
    } else {
      throw new Error('Invalid field type');
    }

    return this.sortObjectKeys({
      ...schema,
      field: name,

      // `integration` was used by the old agent to communicate with the frontend so that it could
      // disable some features (like the search bar) when the agent was not able to provide the
      // corresponding data.
      integration: null,

      // `isVirtual` was quite close in meaning.
      // It was used by the frontend to set apart fields that were implemented by the customers
      // and flag them in the GUI, exclude them from charts, etc...
      isVirtual: false,
    });
  }

  private static buildColumnSchema(collection: Collection, name: string): PartialColumnOrRelation {
    const column = collection.schema.fields[name] as ColumnSchema;
    const isForeignKey = SchemaUtils.isForeignKey(collection.schema, name);

    return {
      defaultValue: column.defaultValue ?? null,
      enums: column.enumValues ?? null,
      inverseOf: null, // Only for relationships

      // As operators are _not_ defined in the schema, the definition of `isFilterable` is
      // a bit tricky: the column is filterable if it supports all operators which are hard-coded
      // in the frontend.
      isFilterable: FrontendFilterableUtils.isFilterable(column.columnType, column.filterOperators),
      isPrimaryKey: Boolean(column.isPrimaryKey),

      // When a column is a foreign key, it is readonly.
      // This may sound counter-intuitive: it is so that the user don't have two fields which
      // allow updating the same foreign key in the detail-view form (fk + many to one)
      isReadOnly: isForeignKey || Boolean(column.isReadOnly),
      isRequired: column.validation?.some(v => v.operator === 'Present') ?? false,
      isSortable: Boolean(column.isSortable),
      reference: null, // Only for relationships
      relationship: null, // Only for relationships
      type: this.convertColumnType(column.columnType),
      validations: FrontendValidationUtils.convertValidationList(column.validation),
    };
  }

  private static buildRelationSchema(
    collection: Collection,
    name: string,
  ): PartialColumnOrRelation {
    const relation = collection.schema.fields[name] as RelationSchema;
    const foreignCollection = collection.dataSource.getCollection(relation.foreignCollection);
    let schema: PartialRelation;

    if (relation.type === 'ManyToOne') {
      schema = this.buildManyToOneSchema(relation, collection, foreignCollection);
    } else if (relation.type === 'OneToOne') {
      schema = this.buildOneToOneSchema(relation, foreignCollection);
    } else if (relation.type === 'OneToMany') {
      schema = this.buildOneToManySchema(relation, collection, foreignCollection);
    } else {
      schema = this.buildManyToManySchema(relation, collection, foreignCollection);
    }

    return {
      ...schema,
      enums: null,
      inverseOf: CollectionUtils.getInverseRelation(collection, name),

      // This field does not appear to be used by the frontend and was always set to true
      // in the old implementation.
      // As we're not sure what it does, we're setting it to true when at least one of the
      // fields of the relation is filterable.
      isFilterable: this.isForeignCollectionFilterable(foreignCollection),

      // Always set isPrimaryKey=false even if the foreign key backing this relationship is
      // the primary key. Doing otherwise breaks the frontend when no reference field is set.
      isPrimaryKey: false,

      // This field is used by the frontend in the related data section:
      // - when true, the frontend checks the schema of the column the individual columns.
      // - when false, all columns of the table-view are set as unsortable.
      isSortable: true,
    };
  }

  private static buildOneToManySchema(
    relation: OneToManySchema,
    collection: Collection,
    foreignCollection: Collection,
  ): PartialRelation {
    const targetField = collection.schema.fields[relation.originKeyTarget] as ColumnSchema;
    const originKey = foreignCollection.schema.fields[relation.originKey] as ColumnSchema;

    return {
      defaultValue: null,
      isReadOnly: Boolean(originKey.isReadOnly),
      isRequired: false,
      reference: `${foreignCollection.name}.${relation.originKeyTarget}`,
      relationship: 'HasMany',
      type: [targetField.columnType as PrimitiveTypes],
      validations: [],
    };
  }

  private static buildManyToManySchema(
    relation: ManyToManySchema,
    collection: Collection,
    foreignCollection: Collection,
  ): PartialRelation {
    const targetField = foreignCollection.schema.fields[relation.foreignKeyTarget] as ColumnSchema;
    const throughSchema = collection.dataSource.getCollection(relation.throughCollection).schema;
    const foreignKey = throughSchema.fields[relation.foreignKey] as ColumnSchema;
    const originKey = throughSchema.fields[relation.originKey] as ColumnSchema;

    return {
      defaultValue: null,
      isReadOnly: Boolean(originKey.isReadOnly || foreignKey.isReadOnly),
      isRequired: false,
      reference: `${foreignCollection.name}.${relation.foreignKeyTarget}`,
      relationship: 'BelongsToMany',
      type: [targetField.columnType as PrimitiveTypes],
      validations: [],
    };
  }

  private static buildOneToOneSchema(
    relation: OneToOneSchema,
    foreignCollection: Collection,
  ): PartialRelation {
    const keyField = foreignCollection.schema.fields[relation.originKey] as ColumnSchema;

    return {
      defaultValue: null,
      isReadOnly: Boolean(keyField.isReadOnly),
      isRequired: false,
      reference: `${foreignCollection.name}.${relation.originKeyTarget}`,
      relationship: 'HasOne',
      type: keyField.columnType as PrimitiveTypes,
      validations: [],
    };
  }

  private static buildManyToOneSchema(
    relation: ManyToOneSchema,
    collection: Collection,
    foreignCollection: Collection,
  ): PartialRelation {
    const keyField = collection.schema.fields[relation.foreignKey] as ColumnSchema;

    return {
      defaultValue: keyField.defaultValue ?? null,
      isReadOnly: Boolean(keyField.isReadOnly),
      isRequired: keyField.validation?.some(v => v.operator === 'Present') ?? false,
      reference: `${foreignCollection.name}.${relation.foreignKeyTarget}`,
      relationship: 'BelongsTo',
      type: keyField.columnType as PrimitiveTypes,
      validations: FrontendValidationUtils.convertValidationList(keyField.validation),
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

  private static isForeignCollectionFilterable(foreignCollection: Collection): boolean {
    return Object.values(foreignCollection.schema.fields).some(
      field =>
        field.type === 'Column' &&
        FrontendFilterableUtils.isFilterable(field.columnType, field.filterOperators),
    );
  }

  private static sortObjectKeys<T extends Record<string, unknown>>(object: T): T {
    return Object.fromEntries(Object.entries(object).sort()) as T;
  }
}
