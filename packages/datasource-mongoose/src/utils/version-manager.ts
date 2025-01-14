/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { ColumnType, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import mongoose, { Schema, SchemaType, VirtualType } from 'mongoose';

const dynamicSchema = new mongoose.Schema({ objectId: mongoose.Schema.Types.ObjectId });

function getNativeType(type) {
  switch (type) {
    case String:
      return 'String';
    case Boolean:
      return 'Boolean';
    case Number:
      return 'Number';
    case Date:
      return 'Date';
    default:
      return null;
  }
}

export default class VersionManager {
  static readonly ObjectIdTypeName = dynamicSchema.paths.objectId.instance;

  public static isSubDocument(field): field is Schema.Types.Subdocument {
    return (
      field?.name === 'EmbeddedDocument' ||
      field?.constructor?.name === 'SubdocumentPath' ||
      (field?.instance === 'Embedded' && field instanceof SchemaType)
    );
  }

  public static isSubDocumentArray(field): field is Schema.Types.DocumentArray {
    return (
      (field?.instance === 'Array' || field?.instance === 'DocumentArray') &&
      field instanceof SchemaType
    );
  }

  public static getRawSchemaFromCaster(definition) {
    return definition.options?.type ? definition.options.type[0] : definition;
  }

  private static getBasicType(type: string) {
    if (type === 'Buffer') {
      return 'Binary';
    }

    if (['String', 'Number', 'Date', 'Boolean'].includes(type)) {
      return type as PrimitiveTypes;
    }

    if ([VersionManager.ObjectIdTypeName, 'Decimal128'].includes(type)) {
      return 'String';
    }

    return 'Json';
  }

  private static getColumnTypeV8(field): ColumnType {
    // Virtual fields are not supported, we cannot type them
    if (!field || field instanceof VirtualType || (typeof field.auto === 'boolean' && field.auto)) {
      return;
    }

    // https://mongoosejs.com/docs/subdocs.html#subdocuments-versus-nested-paths
    if (typeof field === 'function' && field.name !== 'EmbeddedDocument') {
      if (field.options?.type[0]) {
        return [this.getColumnTypeV8(field.options.type[0])];
      }

      return getNativeType(field);
    }

    if (field.type) {
      return this.getColumnTypeV8(field.type);
    }

    if (field.tree) {
      // This a Subtype, handle it recursively
      return Object.entries(field.tree).reduce(
        (acc, [name, subSchema]) => ({
          ...acc,
          [name]: this.getColumnTypeV8(subSchema),
        }),
        {},
      );
    }

    if (this.isSubDocument(field)) {
      // @ts-ignore
      return Object.entries(field.schema.tree).reduce(
        (acc, [name, subSchema]) => ({
          ...acc,
          [name]: VersionManager.getColumnTypeV8(subSchema),
        }),
        {},
      );
    }

    if (this.isSubDocumentArray(field)) {
      return [this.getColumnTypeV8(field.caster)];
    }

    if (field['[]']) {
      return [this.getColumnTypeV8(field['[]'])];
    }

    if (Array.isArray(field) && field[0]) {
      return [this.getColumnTypeV8(field[0])];
    }

    if (field instanceof SchemaType) {
      return this.getBasicType(field.instance);
    }

    // Json defined object
    return Object.entries(field).reduce(
      (memo, [name, subSchema]) => ({
        ...memo,
        [name]: this.getColumnTypeV8(subSchema as SchemaType),
      }),
      {},
    );
  }

  /** Build ColumnType from CleanSchema recursively */
  public static getColumnTypeRec<T = unknown>(field: SchemaType<T>): ColumnType {
    if (mongoose.version.startsWith('8')) {
      return this.getColumnTypeV8(field);
    }

    if (field instanceof SchemaType) {
      return this.getBasicType(field.instance);
    }

    if (field['[]']) {
      return [VersionManager.getColumnTypeRec(field['[]'])];
    }

    return Object.entries(field).reduce(
      (memo, [name, subSchema]) => ({
        ...memo,
        [name]: VersionManager.getColumnTypeRec(subSchema as SchemaType),
      }),
      {},
    );
  }
}
