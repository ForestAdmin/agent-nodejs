import mongoose from 'mongoose';

// In mongoose version 6 "object id" is ObjectID and in version 7 it's ObjectId
// https://mongoosejs.com/docs/migrating_to_7.html

export const ObjectIdVersion6 = 'ObjectID';
export const ObjectIdVersion7 = 'ObjectId';

export type PrimitiveObjectId = typeof ObjectIdVersion6 | typeof ObjectIdVersion7;

export default class VersionManager {
  static readonly ObjectIdTypeName = mongoose.Schema.Types.ObjectId.schemaName;
}
