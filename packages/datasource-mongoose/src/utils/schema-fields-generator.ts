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
    const schemaFields = {};

    Object.entries(model.schema.paths).forEach(([fieldName, field]) => {
      const mixedFieldPattern = '$*';
      const privateFieldPattern = '__';

      if (fieldName.startsWith(privateFieldPattern) || fieldName.includes(mixedFieldPattern)) {
        return;
      }

      if (field.instance === 'Array') {
        schemaFields[fieldName] = SchemaFieldsGenerator.buildArraySchema(
          field as Schema.Types.Array,
        );
      } else if (field.options.ref) {
        schemaFields[`${fieldName}_manyToOne`] = {
          type: 'ManyToOne',
          foreignCollection: field.options.ref,
          foreignKey: field.path,
          foreignKeyTarget: '_id',
        };

        schemaFields[fieldName] = SchemaFieldsGenerator.buildPrimitiveSchema(field, 'String');
      } else {
        schemaFields[field.path.split('.').shift()] = SchemaFieldsGenerator.buildPrimitiveSchema(
          field,
          SchemaFieldsGenerator.getColumnType(field.instance, field),
        );
      }
    });

    return schemaFields;
  }

  private static getColumnType(instance: string, field: SchemaType): ColumnType {
    const potentialEnumValues = this.getEnumValues(field);

    if (field.path.includes('.')) {
      const fieldPath = field.path.split('.');
      fieldPath.shift();
      field.path = fieldPath[fieldPath.length - 1];

      return SchemaFieldsGenerator.getColumnTypeFromNestedPath(fieldPath, field);
    }

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
      case 'Embedded':
        return SchemaFieldsGenerator.getColumnTypeFromNested(field);
      default:
        throw new Error(`Unhandled column type "${instance}"`);
    }
  }

  private static buildPrimitiveSchema(field: SchemaType, columnType: ColumnType): ColumnSchema {
    return {
      columnType,
      filterOperators: FilterOperatorBuilder.getSupportedOperators(columnType as PrimitiveTypes),
      defaultValue: field.options?.default,
      enumValues: this.getEnumValues(field),
      isPrimaryKey: field.path === '_id',
      isReadOnly: !!field.options?.immutable,
      isSortable: !(
        Array.isArray(columnType) ||
        columnType instanceof Object ||
        columnType === 'Json'
      ),
      type: 'Column',
      validation: field.isRequired ? [{ operator: 'Present' }] : null,
    };
  }

  private static getEnumValues(field: SchemaType) {
    return field.options?.enum instanceof Array ? field.options.enum : field.options?.enum?.values;
  }

  private static buildArraySchema(fields: Schema.Types.Array): FieldSchema {
    const { caster } = fields;

    if (caster.schema) {
      return SchemaFieldsGenerator.buildPrimitiveSchema(fields, ['Json']);
    }

    if (caster.instance) {
      return SchemaFieldsGenerator.buildPrimitiveSchema(fields, [
        SchemaFieldsGenerator.getColumnType(caster.instance, fields),
      ]);
    }

    throw new Error(`Unhandled array column "${fields.path}"`);
  }

  private static getColumnTypeFromNested(field: SchemaType): ColumnType {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const paths = field.schema.singleNestedPaths;

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
