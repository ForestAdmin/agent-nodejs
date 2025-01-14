/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { ColumnType, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import mongoose, { Schema, SchemaType } from 'mongoose';

const dynamicSchema = new mongoose.Schema({ objectId: mongoose.Schema.Types.ObjectId });

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

  /** Build ColumnType from CleanSchema recursively */
  public static getColumnTypeRec<T = unknown>(field: SchemaType<T>): ColumnType {
    if (mongoose.version.startsWith('8') && (field as any).paths) {
      return this.getColumnTypeRec((field as any).paths);
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
