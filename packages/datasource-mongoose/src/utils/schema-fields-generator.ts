import {
  CollectionSchema,
  ColumnSchema,
  ColumnType,
  ManyToManySchema,
  ManyToOneSchema,
  OneToManySchema,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model, Schema, SchemaType, model as mongooseModel } from 'mongoose';

import FilterOperatorBuilder from './filter-operator-builder';
import MongooseCollection from '../collection';

export default class SchemaFieldsGenerator {
  static addInverseRelationships(collections: MongooseCollection[]): void {
    const createdFakeManyToManyRelations = [];
    collections.forEach(collection => {
      Object.entries(collection.schema.fields).forEach(([fieldName, fieldSchema]) => {
        if (fieldSchema.type === 'ManyToOne') {
          const foreignCollection = this.getCollection(collections, fieldSchema);

          const field = `${foreignCollection.name}__${fieldSchema.foreignKey}__oneToMany`;
          foreignCollection.schema.fields[field] = {
            foreignCollection: collection.name,
            originKey: fieldSchema.foreignKey,
            originKeyTarget: '_id',
            type: 'OneToMany',
          } as OneToManySchema;
        } else if (
          fieldSchema.type === 'ManyToMany' &&
          !createdFakeManyToManyRelations.find(name => name === fieldName)
        ) {
          const foreignCollection = this.getCollection(collections, fieldSchema);
          const throughCollection = `${collection.name}_${foreignCollection.name}`;
          const foreignKey = `${collection.name}_id`;
          const originKey = `${fieldSchema.foreignKey}`;

          const field = `${foreignCollection.name}__${fieldSchema.originKey}__ManyToMany`;
          foreignCollection.schema.fields[field] = {
            throughCollection,
            foreignKey,
            originKey,
            foreignCollection: collection.name,
            type: 'ManyToMany',
            foreignKeyTarget: '_id',
            originKeyTarget: '_id',
          } as ManyToManySchema;

          const schema = new Schema({
            [foreignKey]: { type: Schema.Types.ObjectId, ref: collection.name },
            [originKey]: { type: Schema.Types.ObjectId, ref: foreignCollection.name },
          });
          const model = mongooseModel(throughCollection, schema);
          collection.dataSource.addCollection(new MongooseCollection(collection.dataSource, model));
          createdFakeManyToManyRelations.push(field);
        }
      });
    });
  }

  private static getCollection(
    collections: MongooseCollection[],
    fieldSchema: ManyToOneSchema | ManyToManySchema,
  ): MongooseCollection {
    const foreignCollection = collections.find(c => c.name === fieldSchema.foreignCollection);

    if (!foreignCollection) {
      throw new Error(`The collection '${fieldSchema.foreignCollection}' does not exist`);
    }

    return foreignCollection;
  }

  static buildFieldsSchema(model: Model<RecordData>): CollectionSchema['fields'] {
    const schemaFields = {};

    Object.entries(model.schema.paths).forEach(([fieldName, field]) => {
      const mixedFieldPattern = '$*';
      const privateFieldPattern = '__';

      if (fieldName.startsWith(privateFieldPattern) || fieldName.includes(mixedFieldPattern)) {
        return;
      }

      if (field.options?.type[0]?.schemaName === 'ObjectId' && field.options?.ref) {
        const foreignCollection = field.options?.ref;

        const { modelName } = model;
        schemaFields[`${fieldName}_manyToMany`] = {
          type: 'ManyToMany',
          foreignCollection,
          throughCollection: `${modelName}_${foreignCollection}`,
          foreignKey: `${foreignCollection}_id`,
          originKey: `${modelName}_id`,
          foreignKeyTarget: '_id',
          originKeyTarget: '_id',
        } as ManyToManySchema;
        schemaFields[fieldName] = SchemaFieldsGenerator.buildColumnSchema(field, 'String');
      } else if (field.options.ref) {
        schemaFields[`${fieldName}_manyToOne`] = {
          type: 'ManyToOne',
          foreignCollection: field.options.ref,
          foreignKey: field.path,
          foreignKeyTarget: '_id',
        } as ManyToOneSchema;
        schemaFields[fieldName] = SchemaFieldsGenerator.buildColumnSchema(field, 'String');
      }

      schemaFields[field.path.split('.').shift()] = SchemaFieldsGenerator.buildColumnSchema(
        field,
        SchemaFieldsGenerator.getColumnType(field.instance, field),
      );
    });

    return schemaFields;
  }

  private static getColumnType(instance: string, field: SchemaType): ColumnType {
    if (field.path.includes('.')) {
      const fieldPath = field.path.split('.');
      fieldPath.shift();
      field.path = fieldPath[fieldPath.length - 1];

      return SchemaFieldsGenerator.getColumnTypeFromNestedPath(fieldPath, field);
    }

    const potentialEnumValues = this.getEnumValues(field);

    if (potentialEnumValues) {
      if (potentialEnumValues.some(value => !(typeof value === 'string'))) {
        throw new Error('Enum support only String values');
      }

      return 'Enum';
    }

    switch (instance) {
      case 'Array':
        return [
          SchemaFieldsGenerator.getColumnType(
            field.schema ? 'Embedded' : (field as Schema.Types.Array).caster.instance,
            field.schema ? field : (field as Schema.Types.Array).caster,
          ),
        ];
      case 'String':
      case 'ObjectID':
      case 'Buffer':
      case 'Decimal128':
        return 'String';
      case 'Number':
        return 'Number';
      case 'Date':
        return 'Date';
      case 'Boolean':
        return 'Boolean';
      case 'Map':
      case 'Mixed':
        return 'Json';
      case 'Embedded':
      default:
        return SchemaFieldsGenerator.getColumnTypeFromNested(field);
    }
  }

  private static buildColumnSchema(field: SchemaType, columnType: ColumnType): ColumnSchema {
    return {
      columnType,
      filterOperators: FilterOperatorBuilder.getSupportedOperators(columnType as PrimitiveTypes),
      defaultValue: field.options?.default,
      enumValues: this.getEnumValues(field),
      isPrimaryKey: field.path === '_id',
      isReadOnly: !!field.options?.immutable,
      isSortable: !(columnType instanceof Object || columnType === 'Json'),
      type: 'Column',
      validation: field.isRequired ? [{ operator: 'Present' }] : null,
    };
  }

  private static getEnumValues(field: SchemaType) {
    return field.options?.enum instanceof Array ? field.options.enum : field.options?.enum?.values;
  }

  private static getColumnTypeFromNested(field: SchemaType): ColumnType {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { singleNestedPaths } = field.schema;
    const paths =
      Object.keys(singleNestedPaths).length > 0 ? singleNestedPaths : field.schema.paths;

    return Object.entries(paths).reduce((columnType, [fieldPath, fieldSchema]) => {
      return SchemaFieldsGenerator.getColumnTypeFromNestedPath(
        fieldPath.split('.'),
        fieldSchema as SchemaType,
        columnType,
      );
    }, {});
  }

  private static getColumnTypeFromNestedPath(
    fieldPath: string[],
    field: SchemaType,
    columnType: ColumnType = {},
  ): ColumnType {
    let previousPath;

    fieldPath.forEach((fieldName, index) => {
      if (fieldName === '_id') {
        return;
      }

      if (index !== fieldPath.length - 1) {
        if (previousPath) {
          if (!previousPath[fieldName]) {
            previousPath[fieldName] = {};
          }

          previousPath = previousPath[fieldName];
        } else {
          if (!columnType[fieldName]) {
            columnType[fieldName] = {};
          }

          previousPath = columnType[fieldName];
        }
      } else {
        if (!previousPath) {
          previousPath = columnType;
        }

        previousPath[fieldName] = SchemaFieldsGenerator.getColumnType(field.instance, field);
      }
    });

    return columnType;
  }
}
