import {
  CollectionSchema,
  ColumnSchema,
  ColumnType,
  FieldSchema,
  PrimitiveTypes,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model, Schema, SchemaType } from 'mongoose';

import FilterOperatorBuilder from './filter-operator-builder';
import MongooseCollection from '../collection';

type MongooseColumnSchema = ColumnSchema & { schema?: CollectionSchema['fields'] };
type ModelFields = { [key: string]: SchemaType };

export default class SchemaFieldsGenerator {
  static addInverseRelationships(collections: MongooseCollection[]): void {
    collections.forEach(collection => {
      Object.values(collection.schema.fields).forEach(fieldSchema => {
        if (fieldSchema.type === 'ManyToOne') {
          const foreignCollection = collections.find(c => c.name === fieldSchema.foreignCollection);
          foreignCollection.schema.fields[`${collection.name}__oneToMany`] = {
            foreignCollection: collection.name,
            originKey: fieldSchema.foreignKey,
            originKeyTarget: '_id',
            type: 'OneToMany',
          };
        }
      });
    });
  }

  static buildFieldsSchema(model: Model<RecordData>): CollectionSchema['fields'] {
    const modelFields = model.schema.paths;
    const prebuildFieldsSchema = SchemaFieldsGenerator.prebuildFieldsSchema(modelFields);

    Object.values(prebuildFieldsSchema).forEach((schemaField: MongooseColumnSchema) => {
      if (schemaField.schema) {
        const type = SchemaFieldsGenerator.getTypeFromNested(schemaField.schema);
        schemaField.columnType = Array.isArray(schemaField.columnType) ? [type] : type;
        delete schemaField.schema;
      }
    });

    return prebuildFieldsSchema;
  }

  private static getColumnType(instance: string, field: SchemaType): ColumnType {
    const potentialEnumValues = this.getEnumValues(field);

    if (potentialEnumValues) {
      if (potentialEnumValues.some(value => !(typeof value === 'string'))) {
        throw new Error('Enum support only String values');
      }

      return 'Enum';
    }

    switch (instance) {
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
      default:
        throw new Error(`Unhandled column type "${instance}"`);
    }
  }

  private static buildPrimitiveSchema(
    field: SchemaType,
    columnType: ColumnType,
  ): MongooseColumnSchema {
    return {
      columnType,
      filterOperators: FilterOperatorBuilder.getSupportedOperators(columnType as PrimitiveTypes),
      defaultValue: field.options?.default,
      enumValues: this.getEnumValues(field),
      isPrimaryKey: field.path === '_id',
      isReadOnly: !!field.options?.immutable,
      isSortable: !(Array.isArray(columnType) || columnType === 'Json'),
      type: 'Column',
      validation: field.isRequired ? [{ operator: 'Present' }] : null,
    };
  }

  private static getEnumValues(field: SchemaType) {
    return field.options?.enum instanceof Array ? field.options.enum : field.options?.enum?.values;
  }

  private static buildArraySchema(field: Schema.Types.Array): FieldSchema {
    const { caster } = field;

    if (caster.schema) {
      const fieldSchema = SchemaFieldsGenerator.buildPrimitiveSchema(field, ['Json']);
      fieldSchema.schema = SchemaFieldsGenerator.prebuildFieldsSchema(caster.schema.paths);

      return fieldSchema;
    }

    if (caster.instance) {
      return SchemaFieldsGenerator.buildPrimitiveSchema(field, [
        SchemaFieldsGenerator.getColumnType(caster.instance, field),
      ]);
    }

    throw new Error(`Unhandled array column "${field.path}"`);
  }

  private static buildNestedPathSchema(
    schemaFields: CollectionSchema['fields'],
    fieldName: string,
    field: SchemaType,
  ) {
    const [fieldPath, ...nestedFieldsPath] = fieldName.split('.');

    if (!nestedFieldsPath.length) {
      const schemaField = SchemaFieldsGenerator.prebuildFieldsSchema({ [fieldPath]: field });
      schemaFields[fieldPath] = schemaField[fieldPath];

      return;
    }

    let fieldSchema = schemaFields[fieldPath] as MongooseColumnSchema;

    if (!fieldSchema) {
      fieldSchema = SchemaFieldsGenerator.buildPrimitiveSchema({} as SchemaType, 'Json');
      fieldSchema.schema = {} as CollectionSchema['fields'];
      schemaFields[fieldPath] = fieldSchema;
    }

    SchemaFieldsGenerator.buildNestedPathSchema(
      fieldSchema.schema,
      nestedFieldsPath.join('.'),
      field,
    );
  }

  private static prebuildFieldsSchema(modelFields: ModelFields): CollectionSchema['fields'] {
    const schemaFields = {};

    Object.entries(modelFields).forEach(([fieldName, field]) => {
      const mixedFieldPattern = '$*';
      const privateFieldPattern = '__';

      if (fieldName.startsWith(privateFieldPattern) || fieldName.includes(mixedFieldPattern)) {
        return schemaFields;
      }

      if (fieldName.includes('.')) {
        SchemaFieldsGenerator.buildNestedPathSchema(schemaFields, fieldName, field);
      } else if (field.instance === 'Array') {
        let fieldSchema = SchemaFieldsGenerator.buildArraySchema(field as Schema.Types.Array);

        if (fieldSchema.type === 'OneToMany') {
          schemaFields[`${fieldName}_oneToMany`] = fieldSchema;
          fieldSchema = SchemaFieldsGenerator.buildPrimitiveSchema(field, [
            SchemaFieldsGenerator.getColumnType('String', field),
          ]);
        }

        schemaFields[fieldName] = fieldSchema;
      } else if (field.options.ref) {
        schemaFields[`${fieldName}_manyToOne`] = {
          type: 'ManyToOne',
          foreignCollection: field.options.ref,
          foreignKey: field.path,
          foreignKeyTarget: '_id',
        };

        schemaFields[fieldName] = SchemaFieldsGenerator.buildPrimitiveSchema(field, 'String');
      } else if (field.schema) {
        const fieldSchema = SchemaFieldsGenerator.buildPrimitiveSchema(field, 'Json');
        fieldSchema.schema = SchemaFieldsGenerator.prebuildFieldsSchema(field.schema.paths);
        schemaFields[fieldName] = fieldSchema;
      } else {
        schemaFields[fieldName] = SchemaFieldsGenerator.buildPrimitiveSchema(
          field,
          SchemaFieldsGenerator.getColumnType(field.instance, field),
        );
      }
    });

    return schemaFields;
  }

  private static getTypeFromNested(fields: CollectionSchema['fields']): ColumnType {
    const columnType: ColumnType = {};

    Object.entries(fields).forEach(([fieldName, fieldSchema]: [string, MongooseColumnSchema]) => {
      if (fieldSchema.schema) {
        const type = SchemaFieldsGenerator.getTypeFromNested(fieldSchema.schema);
        columnType[fieldName] = Array.isArray(fieldSchema.columnType) ? [type] : type;
        delete fieldSchema.schema;
      } else if (fieldSchema.columnType) {
        columnType[fieldName] = fieldSchema.columnType;
      }
    });

    return columnType;
  }
}
