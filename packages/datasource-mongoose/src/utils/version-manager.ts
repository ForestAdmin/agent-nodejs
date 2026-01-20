import type { Schema } from 'mongoose';

import mongoose from 'mongoose';

import isSchemaType from './schema/is-schema-type';

export default class VersionManager {
  static readonly ObjectIdTypeName = mongoose.Schema.Types.ObjectId.schemaName;

  public static isSubDocument(field): field is Schema.Types.Subdocument {
    return (
      field?.name === 'EmbeddedDocument' ||
      field?.constructor?.name === 'SubdocumentPath' || // Mongoose 8 and below
      field?.constructor?.name === 'SchemaSubdocument' || // Mongoose 9+ (single nested)
      field?.constructor?.name === 'SchemaDocumentArrayElement' || // Mongoose 9+ (array element)
      (field?.instance === 'Embedded' && isSchemaType(field)) ||
      (field?.instance === 'DocumentArrayElement' && isSchemaType(field))
    );
  }

  public static isSubDocumentArray(field): field is Schema.Types.DocumentArray {
    return (
      (field?.instance === 'Array' || field?.instance === 'DocumentArray') && isSchemaType(field)
    );
  }

  /**
   * Get the embedded schema type from an array field.
   * In Mongoose 9+, use `embeddedSchemaType` property.
   * In Mongoose 8 and below, use `caster` property.
   */
  public static getEmbeddedSchemaType(
    field: Schema.Types.DocumentArray,
  ): Schema.Types.Subdocument<unknown> {
    // Mongoose 9+ uses embeddedSchemaType
    if (field.embeddedSchemaType !== undefined) {
      return field.embeddedSchemaType;
    }

    // Mongoose 8 and below use caster
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (field as any).caster;
  }
}
