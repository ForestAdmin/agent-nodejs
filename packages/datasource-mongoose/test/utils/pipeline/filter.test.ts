import {
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Page,
  PaginatedFilter,
  Sort,
} from '@forestadmin/datasource-toolkit';
import mongoose, { Model, Schema } from 'mongoose';

import FilterGenerator from '../../../src/utils/pipeline/filter';

describe('FilterGenerator', () => {
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

  describe('Condition tree', () => {
    it('should work with an equal condition', () => {
      const filter = new PaginatedFilter({
        conditionTree: new ConditionTreeLeaf('title', 'ILike', 'Foundation'),
      });

      const pipeline = FilterGenerator.filter(model, null, filter);
      expect(pipeline).toStrictEqual([{ $match: { title: /^Foundation$/gi } }]);
    });

    it('should work with a nested equal condition', () => {
      const filter = new PaginatedFilter({
        conditionTree: new ConditionTreeLeaf('author:identifier', 'NotContains', 'something'),
      });

      const pipeline = FilterGenerator.filter(model, null, filter);
      expect(pipeline).toStrictEqual([
        { $addFields: { 'author.string_identifier': { $toString: '$author.identifier' } } },
        { $match: { 'author.string_identifier': { $not: /.*something.*/ } } },
      ]);
    });

    it('should work with and/or', () => {
      const filter = new PaginatedFilter({
        conditionTree: new ConditionTreeBranch('And', [
          new ConditionTreeLeaf('author:lastname', 'Equal', 'Asimov'),
          new ConditionTreeBranch('Or', [
            new ConditionTreeLeaf('author:firstname', 'Equal', 'Isaac'),
            new ConditionTreeLeaf('author:firstname', 'Equal', 'John'),
          ]),
        ]),
      });

      const pipeline = FilterGenerator.filter(model, null, filter);
      expect(pipeline).toStrictEqual([
        {
          $match: {
            $and: [
              { 'author.lastname': { $eq: 'Asimov' } },
              {
                $or: [
                  { 'author.firstname': { $eq: 'Isaac' } },
                  { 'author.firstname': { $eq: 'John' } },
                ],
              },
            ],
          },
        },
      ]);
    });
  });

  describe('Skip & Limit', () => {
    it('should work', () => {
      const filter = new PaginatedFilter({ page: new Page(100, 150) });

      const pipeline = FilterGenerator.filter(model, null, filter);
      expect(pipeline).toStrictEqual([{ $skip: 100 }, { $limit: 150 }]);
    });
  });

  describe('Sort', () => {
    it('should work', () => {
      const filter = new PaginatedFilter({
        sort: new Sort({ field: 'author:firstname', ascending: true }),
      });

      const pipeline = FilterGenerator.filter(model, null, filter);
      expect(pipeline).toStrictEqual([{ $sort: { 'author.firstname': 1 } }]);
    });
  });
});
