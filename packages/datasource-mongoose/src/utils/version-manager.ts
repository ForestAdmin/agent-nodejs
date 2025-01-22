import mongoose, { Schema, SchemaType } from 'mongoose';

export default class VersionManager {
  static readonly ObjectIdTypeName = mongoose.Schema.Types.ObjectId.schemaName;

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
}
