/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-underscore-dangle  */
import type { SchemaBranch, SchemaNode } from '../../mongoose/schema';
import type { Stack } from '../../types';
import type {
  CollectionSchema,
  ColumnSchema,
  ColumnType,
  ManyToOneSchema,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import type { Model, SchemaType } from 'mongoose';

import { TypeGetter } from '@forestadmin/datasource-toolkit';

import FilterOperatorsGenerator from './filter-operators';
import isSchemaType from './is-schema-type';
import MongooseSchema from '../../mongoose/schema';
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
    const { columnType, enumValues } = this.normalizeRootEnum(this.getColumnTypeRec(field));
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

    if (enumValues) schema.enumValues = enumValues;

    return schema;
  }

  /**
   * At the root of the record (or a root-level array), an enum is exposed as a flat 'Enum' whose
   * values live on the ColumnSchema. The inline `{ type: 'Enum', enumValues }` form produced by
   * getColumnTypeRec is only kept for enums nested inside sub-documents.
   */
  private static normalizeRootEnum(columnType: ColumnType): {
    columnType: ColumnType;
    enumValues?: string[];
  } {
    if (TypeGetter.isEnumColumnType(columnType)) {
      return { columnType: 'Enum', enumValues: columnType.enumValues };
    }

    if (TypeGetter.isArrayOfEnumColumnType(columnType)) {
      return { columnType: ['Enum'], enumValues: columnType[0].enumValues };
    }

    return { columnType };
  }

  /** Build ColumnType from CleanSchema recursively */
  private static getColumnTypeRec(field: SchemaNode): ColumnType {
    if (isSchemaType(field)) {
      if (field.instance === 'Buffer') {
        return 'Binary';
      }

      if (field.instance === 'String') {
        // A string enum keeps its values inline so they survive down to schema serialization,
        // even when nested. normalizeRootEnum flattens it back to 'Enum' at the root.
        const enumValues = this.getEnumValues(field as SchemaType);

        if (enumValues && enumValues.every(v => typeof v === 'string')) {
          return { type: 'Enum', enumValues };
        }

        return 'String';
      }

      if (['Number', 'Date', 'Boolean'].includes(field.instance)) {
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
