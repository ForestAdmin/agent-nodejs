import mongoose, { Model, Schema } from 'mongoose';

import ReparentGenerator from '../../../src/utils/pipeline/reparent';

describe('ReparentGenerator', () => {
  let model: Model<unknown>;

  beforeAll(() => {
    const schema = new Schema({
      title: String,
      publishers: [String],
      author: { firstname: String, lastname: String },
      editions: [{ isbn: String, year: Number }],
    });

    model = mongoose.model('books', schema);
  });

  afterAll(() => {
    mongoose.deleteModel('books');
  });

  it('should work on the root model', () => {
    const pipeline = ReparentGenerator.reparent(model, null);
    expect(pipeline).toEqual([]);
  });

  it('should work on a single child', () => {
    const pipeline = ReparentGenerator.reparent(model, 'author');
    expect(pipeline).toEqual([
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$author',
              {
                _id: { $concat: [{ $toString: '$_id' }, '.author'] },
                _pid: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ]);
  });

  it('should work on a list of childs', () => {
    const pipeline = ReparentGenerator.reparent(model, 'editions');
    expect(pipeline).toEqual([
      { $unwind: { includeArrayIndex: 'index', path: '$editions' } },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$editions',
              {
                _id: { $concat: [{ $toString: '$_id' }, '.editions.', { $toString: '$index' }] },
                _pid: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ]);
  });

  it('should work on a field', () => {
    const pipeline = ReparentGenerator.reparent(model, 'title');
    expect(pipeline).toEqual([
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              { content: '$title' },
              {
                _id: { $concat: [{ $toString: '$_id' }, '.title'] },
                _pid: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ]);
  });

  it('should work on a nested field', () => {
    const pipeline = ReparentGenerator.reparent(model, 'author.lastname');
    expect(pipeline).toEqual([
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$author',
              {
                _id: { $concat: [{ $toString: '$_id' }, '.author'] },
                _pid: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              { content: '$lastname' },
              {
                _id: { $concat: [{ $toString: '$_id' }, '.lastname'] },
                _pid: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ]);
  });

  it('should work on a list of primitives', () => {
    const pipeline = ReparentGenerator.reparent(model, 'publishers');

    expect(pipeline).toEqual([
      { $unwind: { includeArrayIndex: 'index', path: '$publishers' } },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              { content: '$publishers' },
              {
                _id: { $concat: [{ $toString: '$_id' }, '.publishers.', { $toString: '$index' }] },
                _pid: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ]);
  });
});
