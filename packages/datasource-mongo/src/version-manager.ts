import mongoose from 'mongoose';

const dynamicSchema = new mongoose.Schema({ objectId: mongoose.Schema.Types.ObjectId });

export default class VersionManager {
  static readonly ObjectIdTypeName = dynamicSchema.paths.objectId.instance;
}
