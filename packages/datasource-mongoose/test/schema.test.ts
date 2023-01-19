import mongoose, { Model, Schema } from 'mongoose';

import MongooseSchema from '../src/mongoose/schema';

describe('MongooseSchema', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let model: Model<any>;

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

    expect(() => schema.schemaType).toThrow('Schema is not a leaf.');
  });

  it('should list fields', () => {
    const schema = MongooseSchema.fromModel(model);
    const allFields = [
      'title',
      'publishers',
      'author.identifier',
      'author.firstname',
      'author.lastname',
      '_id',
    ];

    expect(schema.listFields()).toEqual(allFields);
    expect(() => schema.listFields(0)).toThrow('Level must be greater than 0.');
    expect(schema.listFields(1)).toEqual(['title', 'publishers', 'author', '_id']);
    expect(schema.listFields(2)).toEqual(allFields);
    expect(schema.listFields(3)).toEqual(allFields);
  });

  it('should throw when listing fields on leaf', () => {
    const schema = MongooseSchema.fromModel(model).getSubSchema('title');

    expect(() => schema.listFields()).toThrow('Cannot list fields on a leaf schema.');
  });

  it('apply stack should not allow empty stacks', () => {
    expect(() => MongooseSchema.fromModel(model).applyStack([])).toThrow(
      'Stack can never be empty.',
    );
  });

  it('apply stack should give the expected result', () => {
    const schema = MongooseSchema.fromModel(model).applyStack([
      { prefix: null, asFields: [], asModels: ['author'] },
      { prefix: 'author', asFields: [], asModels: [] },
    ]);

    expect(schema.listFields()).toStrictEqual([
      'identifier',
      'firstname',
      'lastname',
      '_id',
      'parent.title',
      'parent.publishers',
      'parent._id',
      'parentId',
    ]);
  });
});
