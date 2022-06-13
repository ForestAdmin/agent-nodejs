import mongoose, { Model, Schema } from 'mongoose';

import MongooseSchema from '../../src/mongoose/schema';

describe('MongooseSchema', () => {
  let model: Model<unknown>;

  beforeAll(() => {
    const schema = new Schema({
      title: String,
      publishers: [String],
      author: { identifier: 'ObjectId', firstname: String, lastname: String },
    });

    model = mongoose.model('books', schema);
  });

  afterAll(() => {
    mongoose.deleteModel('books');
  });

  it('should throw if accessing the leaf getter on a branch', () => {
    const schema = MongooseSchema.fromModel(model);

    expect(() => schema.schemaType).toThrow('not a leaf');
  });
});
