import type { Model } from 'mongoose';

import mongoose, { Schema } from 'mongoose';

import ConditionGenerator from '../../../src/utils/pipeline/condition-generator';
import ReparentGenerator from '../../../src/utils/pipeline/reparent';

describe('ReparentGenerator', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let model: Model<any>;

  beforeAll(() => {
    const schema = new Schema({
      title: String,
      publishers: [String],
      author: { firstname: String, lastname: String },
      moreThen30Fields: {
        field1: String,
        field2: String,
        field3: String,
        field4: String,
        field5: String,
        field6: String,
        field7: String,
        field8: String,
        field9: String,
        field10: String,
        field11: String,
        field12: String,
        field13: String,
        field14: String,
        field15: String,
        field16: String,
        field17: String,
        field18: String,
        field19: String,
        field20: String,
        field21: String,
        field22: String,
        field23: String,
        field24: String,
        field25: String,
        field26: String,
        field28: String,
        field29: String,
        field30: String,
        field31: String,
        field32: String,
        field33: String,
      },
      editions: [{ isbn: String, year: Number }],
    });

    model = mongoose.model('books', schema);
  });

  afterAll(() => {
    mongoose.deleteModel('books');
  });

  it('should generate an empty pipeline for the null prefix', () => {
    const stack = [{ prefix: null, asFields: [], asModels: [] }];
    const pipeline = ReparentGenerator.reparent(model, stack);
    expect(pipeline).toEqual([]);
  });

  it('should generate a single $replaceRoot to unnest an object', () => {
    const pipeline = ReparentGenerator.reparent(model, [
      { prefix: null, asFields: [], asModels: ['author'] },
      { prefix: 'author', asFields: [], asModels: [] },
    ]);

    expect(pipeline).toEqual([
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$author',
              ConditionGenerator.tagRecordIfNotExist('author', {
                _id: { $concat: [{ $toString: '$_id' }, '.author'] },
                parentId: '$_id',
                parent: '$$ROOT',
              }),
            ],
          },
        },
      },
    ]);
  });

  it('should generate an $unwind and $replaceRoot to unnest an array of objects', () => {
    const pipeline = ReparentGenerator.reparent(model, [
      { prefix: null, asFields: [], asModels: ['editions'] },
      { prefix: 'editions', asFields: [], asModels: [] },
    ]);

    expect(pipeline).toEqual([
      { $unwind: { includeArrayIndex: 'index', path: '$editions' } },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$editions',
              ConditionGenerator.tagRecordIfNotExist('editions', {
                _id: { $concat: [{ $toString: '$_id' }, '.editions.', { $toString: '$index' }] },
                parentId: '$_id',
                parent: '$$ROOT',
              }),
            ],
          },
        },
      },
    ]);
  });

  it('should generate a $replaceRoot to unnest a field', () => {
    const pipeline = ReparentGenerator.reparent(model, [
      { prefix: null, asFields: [], asModels: ['title'] },
      { prefix: 'title', asFields: [], asModels: [] },
    ]);

    expect(pipeline).toEqual([
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              { content: '$title' },
              ConditionGenerator.tagRecordIfNotExist('title', {
                _id: { $concat: [{ $toString: '$_id' }, '.title'] },
                parentId: '$_id',
                parent: '$$ROOT',
              }),
            ],
          },
        },
      },
    ]);
  });

  it('should generate two $replaceRoot to unnest a deeply nested field', () => {
    const pipeline = ReparentGenerator.reparent(model, [
      { prefix: null, asFields: [], asModels: ['author'] },
      { prefix: 'author', asFields: [], asModels: ['lastname'] },
      { prefix: 'author.lastname', asFields: [], asModels: [] },
    ]);

    expect(pipeline).toEqual([
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              '$author',
              ConditionGenerator.tagRecordIfNotExist('author', {
                _id: { $concat: [{ $toString: '$_id' }, '.author'] },
                parentId: '$_id',
                parent: '$$ROOT',
              }),
            ],
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              { content: '$lastname' },
              ConditionGenerator.tagRecordIfNotExist('lastname', {
                _id: { $concat: [{ $toString: '$_id' }, '.lastname'] },
                parentId: '$_id',
                parent: '$$ROOT',
              }),
            ],
          },
        },
      },
    ]);
  });

  it('should generate an $unwind and $replaceRoot to unnest an array of primitives', () => {
    const pipeline = ReparentGenerator.reparent(model, [
      { prefix: null, asFields: [], asModels: ['publishers'] },
      { prefix: 'publishers', asFields: [], asModels: [] },
    ]);

    expect(pipeline).toEqual([
      { $unwind: { includeArrayIndex: 'index', path: '$publishers' } },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              { content: '$publishers' },
              ConditionGenerator.tagRecordIfNotExist('publishers', {
                _id: { $concat: [{ $toString: '$_id' }, '.publishers.', { $toString: '$index' }] },
                parentId: '$_id',
                parent: '$$ROOT',
              }),
            ],
          },
        },
      },
    ]);
  });

  describe('when flattening objects resulting in more than 30 fields', () => {
    it('should split $addFields operations every 30 fields (DocumentDB limitation)', () => {
      const pipeline = ReparentGenerator.reparent(model, [
        {
          prefix: null,
          asFields: Object.keys(model.schema.paths).filter(path =>
            path.includes('moreThen30Fields'),
          ),
          asModels: [],
        },
      ]);

      const addFields: mongoose.PipelineStage.AddFields[] = pipeline.filter(
        pipelineOperation => '$addFields' in pipelineOperation,
      ) as mongoose.PipelineStage.AddFields[];
      const numberOfFields = addFields.reduce((acc, addField) => {
        return acc + Object.keys(addField.$addFields).length;
      }, 0);
      expect(addFields).toHaveLength(2);
      expect(numberOfFields).toStrictEqual(32);
    });
  });
});
