import {
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Page,
  PaginatedFilter,
  Sort,
} from '@forestadmin/datasource-toolkit';
import mongoose, { Model, Schema } from 'mongoose';

import { Stack } from '../../../src/types';
import FilterGenerator from '../../../src/utils/pipeline/filter';

describe('FilterGenerator', () => {
  let model: Model<unknown>;
  let stack: Stack;

  beforeAll(() => {
    const schema = new Schema({
      title: String,
      publishers: [String],
      author: { identifier: 'ObjectId', firstname: String, lastname: String },
    });

    model = mongoose.model<unknown>('books', schema);
    stack = [{ prefix: null, asFields: [], asModels: [] }];
  });

  afterAll(() => {
    mongoose.deleteModel('books');
  });

  describe('filter', () => {
    describe('Condition tree', () => {
      it('filter should generate a $match stage', () => {
        const filter = new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf('title', 'Match', /^Foundation$/gi),
        });

        const pipeline = FilterGenerator.filter(model, stack, filter);
        expect(pipeline).toStrictEqual([{ $match: { title: /^Foundation$/gi } }]);
      });

      it('filter should generate a $addFields and $match stage', () => {
        const filter = new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf('author:identifier', 'NotContains', 'something'),
        });

        const pipeline = FilterGenerator.filter(model, stack, filter);
        expect(pipeline).toStrictEqual([
          { $addFields: { 'author.string_identifier': { $toString: '$author.identifier' } } },
          { $match: { 'author.string_identifier': { $not: /.*something.*/ } } },
        ]);
      });

      it('filter should generate a $match stage with $and and $or nodes', () => {
        const filter = new PaginatedFilter({
          conditionTree: new ConditionTreeBranch('And', [
            new ConditionTreeLeaf('author:lastname', 'Equal', 'Asimov'),
            new ConditionTreeBranch('Or', [
              new ConditionTreeLeaf('author:firstname', 'Equal', 'Isaac'),
              new ConditionTreeLeaf('author:firstname', 'Equal', 'John'),
            ]),
          ]),
        });

        const pipeline = FilterGenerator.filter(model, stack, filter);
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
      it('should generate the relevant pipeline', () => {
        const filter = new PaginatedFilter({ page: new Page(100, 150) });

        const pipeline = FilterGenerator.filter(model, stack, filter);
        expect(pipeline).toStrictEqual([{ $skip: 100 }, { $limit: 150 }]);
      });
    });

    describe('Sort', () => {
      it('should generate the relevant pipeline', () => {
        const filter = new PaginatedFilter({
          sort: new Sort({ field: 'author:firstname', ascending: true }),
        });

        const pipeline = FilterGenerator.filter(model, stack, filter);
        expect(pipeline).toStrictEqual([{ $sort: { 'author.firstname': 1 } }]);
      });
    });
  });

  describe('listRelationsUsedInFilter', () => {
    describe('sort', () => {
      it('should add relations used to sort', () => {
        const filter = new PaginatedFilter({
          sort: new Sort(
            { field: 'author:firstname', ascending: true },
            {
              field: 'editor:name',
              ascending: false,
            },
          ),
        });

        const fields = FilterGenerator.listRelationsUsedInFilter(filter);
        expect(fields).toEqual(new Set(['author', 'editor']));
      });

      it('should not add anything if sorting is done on direct fields', () => {
        const filter = new PaginatedFilter({
          sort: new Sort({ field: 'title', ascending: true }),
        });

        const fields = FilterGenerator.listRelationsUsedInFilter(filter);
        expect(fields).toEqual(new Set());
      });

      it('should not add anything if sort is undefined', () => {
        const filter = new PaginatedFilter({});

        const fields = FilterGenerator.listRelationsUsedInFilter(filter);
        expect(fields).toEqual(new Set());
      });

      it('should add all parents and correctly format nested fields', () => {
        const filter = new PaginatedFilter({
          sort: new Sort({ field: 'author:country:name', ascending: true }),
        });

        const fields = FilterGenerator.listRelationsUsedInFilter(filter);
        expect(fields).toEqual(new Set(['author', 'author.country']));
      });
    });

    describe('filter tree', () => {
      it('should add relations used in filter tree', () => {
        const filter = new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf('author:lastname', 'Equal', 'Asimov'),
        });

        const fields = FilterGenerator.listRelationsUsedInFilter(filter);
        expect(fields).toEqual(new Set(['author']));
      });

      it('should add relations used in filter tree with multiple conditions', () => {
        const filter = new PaginatedFilter({
          conditionTree: new ConditionTreeBranch('And', [
            new ConditionTreeLeaf('author:lastname', 'Equal', 'Asimov'),
            new ConditionTreeLeaf('editor:name', 'Equal', 'John Doe'),
          ]),
        });

        const fields = FilterGenerator.listRelationsUsedInFilter(filter);
        expect(fields).toEqual(new Set(['author', 'editor']));
      });

      it('should add relations used in filter tree with nested fields', () => {
        const filter = new PaginatedFilter({
          conditionTree: new ConditionTreeLeaf('author:country:name', 'Equal', 'France'),
        });

        const fields = FilterGenerator.listRelationsUsedInFilter(filter);
        expect(fields).toEqual(new Set(['author', 'author.country']));
      });
    });
  });
});
