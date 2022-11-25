import mongoose, { Model, Schema } from 'mongoose';

import ReparentGenerator from '../../../src/utils/pipeline/reparent';

describe('ReparentGenerator', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let model: Model<any>;

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

  it('should generate an empty pipeline for the null prefix', () => {
    const pipeline = ReparentGenerator.reparent(model, null);
    expect(pipeline).toEqual([]);
  });

  it('should generate a single $replaceRoot to unnest an object', () => {
    const pipeline = ReparentGenerator.reparent(model, 'author');
    expect(pipeline).toEqual([
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$author',
              {
                _id: { $concat: [{ $toString: '$_id' }, '.author'] },
                parentId: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ]);
  });

  it('should generate an $unwind and $replaceRoot to unnest an array of objects', () => {
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
                parentId: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ]);
  });

  it('should generate a $replaceRoot to unnest a field', () => {
    const pipeline = ReparentGenerator.reparent(model, 'title');
    expect(pipeline).toEqual([
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              { content: '$title' },
              {
                _id: { $concat: [{ $toString: '$_id' }, '.title'] },
                parentId: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ]);
  });

  it('should generate two $replaceRoot to unnest a deeply nested field', () => {
    const pipeline = ReparentGenerator.reparent(model, 'author.lastname');
    expect(pipeline).toEqual([
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$author',
              {
                _id: { $concat: [{ $toString: '$_id' }, '.author'] },
                parentId: '$_id',
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
                parentId: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ]);
  });

  it('should generate an $unwind and $replaceRoot to unnest an array of primitives', () => {
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
                parentId: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ]);
  });
});
