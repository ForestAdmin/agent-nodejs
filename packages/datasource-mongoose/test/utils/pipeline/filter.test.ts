import type { Stack } from '../../../src/types';
import type { Model } from 'mongoose';

import {
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Page,
  PaginatedFilter,
  Sort,
} from '@forestadmin/datasource-toolkit';
import mongoose, { Schema } from 'mongoose';

import FilterGenerator, { FilterAtStage } from '../../../src/utils/pipeline/filter';

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

        const sortAndPaginate = FilterGenerator.sortAndPaginate(model, filter);
        expect(sortAndPaginate.sortAndLimitStages).toStrictEqual([{ $skip: 100 }, { $limit: 150 }]);
        expect(sortAndPaginate.filterAtStage).toStrictEqual(FilterAtStage.Early);
      });
    });

    describe('Sort', () => {
      describe('if no sort is applied but there is a limit', () => {
        describe('if no filter is required', () => {
          it('should sort + limit in the first stage', () => {
            const filter = new PaginatedFilter({
              sort: undefined,
              page: new Page(0, 100),
            });

            const sortAndPaginate = FilterGenerator.sortAndPaginate(model, filter);
            expect(sortAndPaginate.sortAndLimitStages).toStrictEqual([
              { $skip: 0 },
              { $limit: 100 },
            ]);
            expect(sortAndPaginate.filterAtStage).toStrictEqual(FilterAtStage.Early);
          });
        });

        describe('if a native filter is required', () => {
          it('should sort + limit in the second stage', () => {
            const filter = new PaginatedFilter({
              sort: undefined,
              page: new Page(0, 100),
            });
            filter.conditionTree = new ConditionTreeBranch('And', [
              new ConditionTreeLeaf('title', 'Equal', 'Lord of the Rings'),
            ]);

            const sortAndPaginate = FilterGenerator.sortAndPaginate(model, filter);
            expect(sortAndPaginate.sortAndLimitStages).toStrictEqual([
              { $skip: 0 },
              { $limit: 100 },
            ]);
            expect(sortAndPaginate.filterAtStage).toStrictEqual(FilterAtStage.AfterFiltering);
          });
        });

        describe('if filtering is not on a native field', () => {
          it('should sort + limit in the third stage', () => {
            const filter = new PaginatedFilter({
              sort: undefined,
              page: new Page(0, 100),
            });
            filter.conditionTree = new ConditionTreeBranch('And', [
              new ConditionTreeLeaf('author:firstname', 'Equal', 'JRR Tolkien'),
            ]);

            const sortAndPaginate = FilterGenerator.sortAndPaginate(model, filter);
            expect(sortAndPaginate.sortAndLimitStages).toStrictEqual([
              { $skip: 0 },
              { $limit: 100 },
            ]);
            expect(sortAndPaginate.filterAtStage).toStrictEqual(FilterAtStage.AfterLookup);
          });
        });
      });

      describe('if sort is done on native field', () => {
        it('should generate the relevant pipeline on the first stage', () => {
          const filter = new PaginatedFilter({
            sort: new Sort({ field: 'author:firstname', ascending: true }),
          });

          const sortAndPaginate = FilterGenerator.sortAndPaginate(model, filter);
          expect(sortAndPaginate.sortAndLimitStages).toStrictEqual([
            { $sort: { 'author.firstname': 1 } },
          ]);
          expect(sortAndPaginate.filterAtStage).toStrictEqual(FilterAtStage.Early);
        });
      });

      describe('if filtering is applied', () => {
        describe('if filtering is on a native field', () => {
          it('should generate the relevant pipeline on first stage', () => {
            const filter = new PaginatedFilter({
              sort: new Sort({ field: 'author:firstname', ascending: true }),
            });
            filter.conditionTree = new ConditionTreeBranch('And', [
              new ConditionTreeLeaf('title', 'Equal', 'Lord of the Rings'),
            ]);

            const sortAndPaginate = FilterGenerator.sortAndPaginate(model, filter);
            expect(sortAndPaginate.sortAndLimitStages).toStrictEqual([
              { $sort: { 'author.firstname': 1 } },
            ]);
            expect(sortAndPaginate.filterAtStage).toStrictEqual(FilterAtStage.AfterFiltering);
          });
        });

        describe('if filtering is not on a native field', () => {
          it('should generate the relevant pipeline on third stage', () => {
            const filter = new PaginatedFilter({
              sort: new Sort({ field: 'author:firstname', ascending: true }),
            });
            filter.conditionTree = new ConditionTreeBranch('And', [
              new ConditionTreeLeaf('editor', 'Equal', 'Folio'),
            ]);

            const sortAndPaginate = FilterGenerator.sortAndPaginate(model, filter);
            expect(sortAndPaginate.sortAndLimitStages).toStrictEqual([
              { $sort: { 'author.firstname': 1 } },
            ]);
            expect(sortAndPaginate.filterAtStage).toStrictEqual(FilterAtStage.AfterLookup);
          });
        });
      });

      describe('if sort criteria is not on a native field', () => {
        it('should generate the relevant pipeline on third stage', () => {
          const filter = new PaginatedFilter({
            sort: new Sort({ field: 'hello', ascending: true }),
          });

          const sortAndPaginate = FilterGenerator.sortAndPaginate(model, filter);
          expect(sortAndPaginate.sortAndLimitStages).toStrictEqual([{ $sort: { hello: 1 } }]);
          expect(sortAndPaginate.filterAtStage).toStrictEqual(FilterAtStage.AfterLookup);
        });
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
