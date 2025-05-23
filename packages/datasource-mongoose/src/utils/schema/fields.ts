/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-underscore-dangle  */
import {
  CollectionSchema,
  ColumnSchema,
  ColumnType,
  ManyToOneSchema,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import { Model, SchemaType } from 'mongoose';

import FilterOperatorsGenerator from './filter-operators';
import isSchemaType from './is-schema-type';
import MongooseSchema, { SchemaBranch, SchemaNode } from '../../mongoose/schema';
import { Stack } from '../../types';
import { escape } from '../helpers';
import VersionManager from '../version-manager';

/** Generate forest admin schema from mongoose schema */
export default class FieldsGenerator {
  static buildFieldsSchema(
    model: Model<unknown>,
    stack: Stack = [{ prefix: null, asFields: [], asModels: [] }],
  ): CollectionSchema['fields'] {
    const ourSchema: CollectionSchema['fields'] = {};
    const childSchema = MongooseSchema.fromModel(model).applyStack(stack);

    // Add columns and many to one relations
    for (const [name, field] of Object.entries(childSchema.fields)) {
      if (name !== 'parent') {
        ourSchema[name] = this.buildColumnSchema(field);

        if (isSchemaType(field) && field.options.ref) {
          ourSchema[`${name}__manyToOne`] = this.buildManyToOne(field.options.ref, name);
        }
      }
    }

    // When a prefix is used add pk + fk + many to one relation to the parent.
    if (stack.length > 1) {
      const parentPrefix = stack[stack.length - 2].prefix;

      ourSchema._id = this.buildVirtualPrimaryKey();
      ourSchema.parentId = {
        ...this.buildColumnSchema((childSchema.fields.parent as SchemaBranch)._id),
        isPrimaryKey: false,
        validation: [{ operator: 'Present' }],
      };

      ourSchema.parent = this.buildManyToOne(
        escape(parentPrefix !== null ? `${model.modelName}.${parentPrefix}` : model.modelName),
        'parentId',
      );
    }

    return ourSchema;
  }

  /** Fake primary key that will be used when we're flattening collections */
  private static buildVirtualPrimaryKey(): ColumnSchema {
    return {
      type: 'Column',
      columnType: 'String',
      filterOperators: FilterOperatorsGenerator.getSupportedOperators('String'),
      isPrimaryKey: true,
      isReadOnly: true,
      isSortable: true,
    };
  }

  private static buildManyToOne(collection: string, foreignKey: string): ManyToOneSchema {
    return {
      type: 'ManyToOne',
      foreignCollection: collection,
      foreignKey,
      foreignKeyTarget: '_id',
    };
  }

  /** Build ColumnSchema from CleanSchema */
  private static buildColumnSchema(field: SchemaNode): ColumnSchema {
    const columnType = this.getColumnType(field);
    const schema: ColumnSchema = {
      columnType,
      filterOperators: FilterOperatorsGenerator.getSupportedOperators(columnType as PrimitiveTypes),
      defaultValue: field.options?.default,
      isPrimaryKey: field.path === '_id',
      isReadOnly: !!field.options?.immutable,
      isSortable: !(columnType instanceof Object || columnType === 'Json'),
      type: 'Column',
      validation: field.isRequired ? [{ operator: 'Present' }] : null,
    };

    if (columnType === 'Enum') {
      schema.enumValues = this.getEnumValues(field as SchemaType);
    }

    return schema;
  }

  /** Compute column type from CleanSchema */
  private static getColumnType(field: SchemaNode): ColumnType {
    const columnType = this.getColumnTypeRec(field);

    // Enum fields are promoted to enum instead of string _only_ if they are at the root of the
    // record.
    if (columnType === 'String') {
      const enumValues = this.getEnumValues(field as SchemaType);

      if (enumValues && enumValues.every(v => typeof v === 'string')) {
        return 'Enum';
      }
    }

    return columnType;
  }

  /** Build ColumnType from CleanSchema recursively */
  private static getColumnTypeRec(field: SchemaNode): ColumnType {
    if (isSchemaType(field)) {
      if (field.instance === 'Buffer') {
        return 'Binary';
      }

      if (['String', 'Number', 'Date', 'Boolean'].includes(field.instance)) {
        return field.instance as PrimitiveTypes;
      }

      if ([VersionManager.ObjectIdTypeName, 'Decimal128'].includes(field.instance)) {
        return 'String';
      }

      return 'Json';
    }

    if (field['[]']) {
      return [this.getColumnTypeRec(field['[]'])];
    }

    return Object.entries(field).reduce(
      (memo, [name, subSchema]) => ({ ...memo, [name]: this.getColumnTypeRec(subSchema) }),
      {},
    );
  }

  /** Get enum validator from field definition */
  private static getEnumValues(field: SchemaType): string[] {
    return field.options?.enum instanceof Array ? field.options.enum : field.options?.enum?.values;
  }
}
