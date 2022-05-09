import {
  CollectionSchema,
  ColumnSchema,
  ColumnType,
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

          if (!foreignCollection) {
            throw new Error(`The collection '${fieldSchema.foreignCollection}' does not exist`);
          }

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

      if (field.options.ref) {
        schemaFields[`${fieldName}_manyToOne`] = {
          type: 'ManyToOne',
          foreignCollection: field.options.ref,
          foreignKey: field.path,
          foreignKeyTarget: '_id',
        };

        schemaFields[fieldName] = SchemaFieldsGenerator.buildPrimitiveSchema(field, 'String');
      }

      schemaFields[field.path.split('.').shift()] = SchemaFieldsGenerator.buildPrimitiveSchema(
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

  private static buildPrimitiveSchema(field: SchemaType, columnType: ColumnType): ColumnSchema {
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
