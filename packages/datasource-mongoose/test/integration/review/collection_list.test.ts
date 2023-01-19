/* eslint-disable no-underscore-dangle */

import {
  Aggregator,
  ConditionTreeLeaf,
  Operator,
  Page,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import setupReview from './_build-models';
import MongooseDatasource from '../../../src/datasource';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  describe('page', () => {
    it('should returns the expected list by given a skip and limit', async () => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const expectedRecordC = { message: 'C' };
      const expectedRecordB = { message: 'B' };
      const expectedRecordA = { message: 'A' };
      await review.create(factories.caller.build(), [
        expectedRecordC,
        expectedRecordB,
        expectedRecordA,
      ]);

      const records = await review.list(
        factories.caller.build(),
        factories.filter.build({ page: new Page(1, 1) }),
        new Projection('message'),
      );

      expect(records).toEqual([{ message: 'B' }]);
    });
  });

  describe('sort', () => {
    it('should sort the records by ascending', async () => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const expectedRecordC = { message: 'C' };
      const expectedRecordB = { message: 'B' };
      const expectedRecordA = { message: 'A' };
      await review.create(factories.caller.build(), [
        expectedRecordC,
        expectedRecordB,
        expectedRecordA,
      ]);

      const records = await review.list(
        factories.caller.build(),
        factories.filter.build({ sort: new Sort({ field: 'message', ascending: true }) }),
        new Projection('message'),
      );

      expect(records).toEqual([{ message: 'A' }, { message: 'B' }, { message: 'C' }]);
    });

    it('should sort the records by descending', async () => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const expectedRecordC = { message: 'C' };
      const expectedRecordB = { message: 'B' };
      const expectedRecordA = { message: 'A' };
      await review.create(factories.caller.build(), [
        expectedRecordC,
        expectedRecordB,
        expectedRecordA,
      ]);

      const records = await review.list(
        factories.caller.build(),
        factories.filter.build({ sort: new Sort({ field: 'message', ascending: false }) }),
        new Projection('message'),
      );

      expect(records).toEqual([{ message: 'C' }, { message: 'B' }, { message: 'A' }]);
    });
  });

  describe('projection', () => {
    it('should return the given record with the given projection', async () => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const expectedRecord = { message: 'a message', title: 'a title' };
      await review.create(factories.caller.build(), [expectedRecord]);

      const records = await review.list(
        factories.caller.build(),
        factories.filter.build(),
        new Projection('message'),
      );

      expect(records).toEqual([{ message: 'a message' }]);
    });
  });

  describe('condition tree', () => {
    it.each([
      [
        { value: ['00000003411bcba43b97a6fb'], operator: 'In', field: 'editorIds' },
        new Projection('editorIds'),
        [{ editorIds: ['000000017578d48e343067c3', '00000003411bcba43b97a6fb'] }],
      ],
      [
        {
          value: ['000000017578d48e343067c3', '00000003411bcba43b97a6fb'],
          operator: 'Equal',
          field: 'editorIds',
        },
        new Projection('editorIds'),
        [{ editorIds: ['000000017578d48e343067c3', '00000003411bcba43b97a6fb'] }],
      ],
      [
        { value: ['2016-02-15T00:00:00.000Z'], operator: 'In', field: 'modificationDates' },
        new Projection('modificationDates'),
        [{ modificationDates: ['2016-02-15T00:00:00.000Z', '2016-02-20T00:00:00.000Z'] }],
      ],
      [
        { value: '2016-02-15', operator: 'LessThan', field: 'createdDate' },
        new Projection('createdDate'),
        [{ createdDate: '2015-02-15T00:00:00.000Z' }],
      ],
      [
        { value: 9, operator: 'GreaterThan', field: 'rating' },
        new Projection('rating'),
        [{ rating: 10 }],
      ],
      [
        { value: 9, operator: 'LessThan', field: 'rating' },
        new Projection('rating'),
        [{ rating: 5 }],
      ],
      [
        { value: 10, operator: 'Equal', field: 'rating' },
        new Projection('rating'),
        [{ rating: 10 }],
      ],
      [
        { value: 10, operator: 'NotEqual', field: 'rating' },
        new Projection('rating'),
        [{ rating: 5 }],
      ],
      [
        { value: [10, 5], operator: 'In', field: 'rating' },
        new Projection('rating'),
        [{ rating: 10 }, { rating: 5 }],
      ],
      [
        { value: ['A', 'B'], operator: 'IncludesAll', field: 'tags' },
        new Projection('tags'),
        [{ tags: ['A', 'B'] }],
      ],
      [
        { value: ['A'], operator: 'NotContains', field: 'tags' },
        new Projection('tags'),
        [{ tags: ['B', 'C'] }],
      ],
      [
        { value: '%message%', operator: 'Like', field: 'message' },
        new Projection('message'),
        [{ message: 'a message' }, { message: 'message' }],
      ],
      [{ operator: 'Present', field: 'title' }, new Projection('title'), [{ title: 'a title' }]],
    ])('[%p] should support the operator', async (conditionTree, projection, expectedResult) => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const record1 = {
        message: 'a message',
        title: 'a title',
        rating: 10,
        nestedField: { nested: [{ level: 10 }] },
        createdDate: '2016-02-15T00:00:00Z',
        tags: ['A', 'B'],
        modificationDates: ['2016-02-15', '2016-02-20'],
        editorIds: ['000000017578d48e343067c3', '000000017578d48e343067c9'],
      };
      const record2 = {
        message: 'message',
        title: null,
        rating: 5,
        nestedField: { nested: [{ level: 5 }, { level: 6 }] },
        createdDate: '2015-02-15T00:00:00Z',
        tags: ['B', 'C'],
        modificationDates: ['2015-02-15', '2015-02-20'],
        editorIds: ['000000017578d48e343067c3', '00000003411bcba43b97a6fb'],
      };
      await review.create(factories.caller.build(), [record1, record2]);

      const records = await review.list(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build(conditionTree as ConditionTreeLeaf),
        }),
        projection,
      );

      expect(records).toEqual(expectedResult);
    });

    it('should throw an error when the operator is invalid', async () => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      await review.create(factories.caller.build(), [{ message: 'a message' }]);

      await expect(() =>
        review.list(
          factories.caller.build(),
          factories.filter.build({
            conditionTree: factories.conditionTreeLeaf.build({
              field: 'message',
              operator: 'BAD' as Operator,
            }),
          }),
          new Projection(),
        ),
      ).rejects.toThrow("Unsupported 'BAD' operator");
    });

    it('should throw an error when the aggregator is invalid', async () => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      await review.create(factories.caller.build(), [{ message: 'a message' }]);

      await expect(() =>
        review.list(
          factories.caller.build(),
          factories.filter.build({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'BAD' as Aggregator,
            }),
          }),
          new Projection(),
        ),
      ).rejects.toThrow('unknown top level operator: $bad.');
    });

    it('supports default operators when the primary key objectId is given', async () => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const targetedId = new Types.ObjectId().toString();
      const expectedRecord = { _id: targetedId };
      const unexpectedRecord = { _id: new Types.ObjectId().toString() };
      await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

      const records = await review.list(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            value: targetedId,
            operator: 'Equal',
            field: '_id',
          }),
        }),
        new Projection('_id'),
      );

      expect(records).toEqual([{ _id: targetedId }]);
    });

    it('supports string operators when the _id as string is given', async () => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const targetedId = new Types.ObjectId().toString();
      const expectedRecord = { _id: targetedId };
      const unexpectedRecord = { _id: new Types.ObjectId().toString() };
      await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

      const records = await review.list(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            value: targetedId.toString(),
            operator: 'Like',
            field: '_id',
          }),
        }),
        new Projection('_id'),
      );

      expect(records).toEqual([{ _id: targetedId }]);
    });

    it('supports string operators when an objectId is given', async () => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const targetedId = new Types.ObjectId().toString();
      const expectedRecord = { authorId: targetedId };
      const unexpectedRecord = { authorId: new Types.ObjectId().toString() };
      await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

      const records = await review.list(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            value: targetedId.toString(),
            operator: 'Like',
            field: 'authorId',
          }),
        }),
        new Projection('authorId'),
      );

      expect(records).toEqual([{ authorId: targetedId }]);
    });

    it('supports operators when an [objectId] as string is given', async () => {
      connection = await setupReview('collection_review_list');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const targetedId = new Types.ObjectId().toString();
      const expectedRecord = { authorId: targetedId };
      const unexpectedRecord = { authorId: new Types.ObjectId().toString() };
      await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

      const records = await review.list(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            value: [targetedId.toString()],
            operator: 'In',
            field: 'authorId',
          }),
        }),
        new Projection('authorId'),
      );

      expect(records).toEqual([{ authorId: targetedId }]);
    });

    describe('when only a leaf condition is given', () => {
      it('should return the expected list', async () => {
        connection = await setupReview('collection_review_list');
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const expectedRecord = { message: 'a message' };
        const unexpectedRecord = { message: 'message' };
        await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

        const records = await review.list(
          factories.caller.build(),
          factories.filter.build({
            conditionTree: factories.conditionTreeLeaf.build({
              value: 'a message',
              operator: 'Equal',
              field: 'message',
            }),
          }),
          new Projection('message'),
        );

        expect(records).toEqual([{ message: 'a message' }]);
      });

      it('applies a condition tree on a nested field', async () => {
        connection = await setupReview('collection_review_list');
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const expectedRecord = { nestedField: { nested: [{ level: 10 }] } };
        const unexpectedRecord = { nestedField: { nested: [{ level: 5 }] } };
        await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

        const records = await review.list(
          factories.caller.build(),
          factories.filter.build({
            conditionTree: factories.conditionTreeLeaf.build({
              value: 9,
              operator: 'GreaterThan',
              field: 'nestedField.nested.level',
            }),
          }),
          new Projection('nestedField.nested.level'),
        );

        expect(records).toEqual([{ nestedField: { nested: [{ level: 10 }] } }]);
      });
    });

    describe('with Or branches', () => {
      it('should return the expected list', async () => {
        connection = await setupReview('collection_review_list');
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const expectedRecord1 = { message: 'match message 1' };
        const expectedRecord2 = { message: 'match message 2' };
        const unexpectedRecord = { message: 'message', title: 'a title' };
        await review.create(factories.caller.build(), [
          expectedRecord1,
          expectedRecord2,
          unexpectedRecord,
        ]);

        const records = await review.list(
          factories.caller.build(),
          factories.filter.build({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'Or',
              conditions: [
                factories.conditionTreeLeaf.build({
                  value: 'match message 1',
                  operator: 'Equal',
                  field: 'message',
                }),
                factories.conditionTreeLeaf.build({
                  value: 'match message 2',
                  operator: 'Equal',
                  field: 'message',
                }),
              ],
            }),
          }),
          new Projection('message'),
        );

        expect(records).toEqual([{ message: 'match message 1' }, { message: 'match message 2' }]);
      });
    });

    describe('with And branches', () => {
      it('should return the expected list', async () => {
        connection = await setupReview('collection_review_list');
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const expectedRecord = { message: 'match message', title: 'a title 1' };
        const unexpectedRecord1 = { message: 'match message', title: 'a title 2' };
        const unexpectedRecord2 = { message: 'message', title: 'a title' };
        await review.create(factories.caller.build(), [
          expectedRecord,
          unexpectedRecord2,
          unexpectedRecord1,
        ]);

        const records = await review.list(
          factories.caller.build(),
          factories.filter.build({
            conditionTree: factories.conditionTreeBranch.build({
              aggregator: 'And',
              conditions: [
                factories.conditionTreeLeaf.build({
                  value: 'match message',
                  operator: 'Equal',
                  field: 'message',
                }),
                factories.conditionTreeLeaf.build({
                  value: 'a title 1',
                  operator: 'Equal',
                  field: 'title',
                }),
              ],
            }),
          }),
          new Projection('message', 'title'),
        );

        expect(records).toEqual([{ message: 'match message', title: 'a title 1' }]);
      });
    });
  });
});
