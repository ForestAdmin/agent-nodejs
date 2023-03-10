import mongoose from 'mongoose';

export default class VersionManager {
  static readonly ObjectIdTypeName: 'ObjectId' | 'ObjectID' = mongoose.version.startsWith('6')
    ? 'ObjectID'
    : 'ObjectId';
}
