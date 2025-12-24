import type { Schema } from 'mongoose';

import mongoose from 'mongoose';

import isSchemaType from './schema/is-schema-type';

export default class VersionManager {
  static readonly ObjectIdTypeName = mongoose.Schema.Types.ObjectId.schemaName;

  public static isSubDocument(field): field is Schema.Types.Subdocument {
    return (
      field?.name === 'EmbeddedDocument' ||
      field?.constructor?.name === 'SubdocumentPath' ||
      (field?.instance === 'Embedded' && isSchemaType(field))
    );
  }

  public static isSubDocumentArray(field): field is Schema.Types.DocumentArray {
    return (
      (field?.instance === 'Array' || field?.instance === 'DocumentArray') && isSchemaType(field)
    );
  }
}
