/* eslint-disable no-underscore-dangle */
/* eslint-disable jest/no-disabled-tests */

import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Aggregation, Filter } from '@forestadmin/datasource-toolkit';
import { Connection, Types } from 'mongoose';

import {
  setupReview,
  setupWith2ManyToManyRelations,
  setupWithManyToOneRelation,
} from '../_helpers';
import MongooseDatasource from '../../src/datasource';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  describe('aggregate', () => {
    it('applies an aggregation operator on a relation field', async () => {
      connection = await setupWithManyToOneRelation('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const store = dataSource.getCollection('store');
      const owner = dataSource.getCollection('owner');

      const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
      const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
      await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
      const ownerRecordA = {
        storeId: storeRecordA._id,
      };
      const ownerRecordB = {
        storeId: storeRecordB._id,
      };
      await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

      const aggregation = new Aggregation({
        operation: 'Max',
        field: 'storeId__manyToOne:name',
      });
      const records = await owner.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([{ value: 'B', group: {} }]);
    });

    it('applies a group on a relation field', async () => {
      connection = await setupWithManyToOneRelation('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const store = dataSource.getCollection('store');
      const owner = dataSource.getCollection('owner');

      const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
      const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
      await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
      const ownerRecordA = {
        storeId: storeRecordA._id,
      };
      const ownerRecordB = {
        storeId: storeRecordB._id,
      };
      await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordA, ownerRecordB]);

      const aggregation = new Aggregation({
        operation: 'Count',
        field: 'storeId__manyToOne:name',
        groups: [{ field: 'storeId__manyToOne:name' }],
      });
      const records = await owner.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { 'storeId__manyToOne:name': 'A' }, value: 2 },
        { group: { 'storeId__manyToOne:name': 'B' }, value: 1 },
      ]);
    });

    it('applies Limit on the results', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1, message: 'message 1' };
      const rating2 = { rating: 2, message: 'message 1' };
      const rating3 = { rating: 15, message: 'message 2' };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Max',
        field: 'rating',
        groups: [{ field: 'message' }],
      });
      const limit = 1;
      const records = await review.aggregate(
        factories.caller.build(),
        new Filter({}),
        aggregation,
        limit,
      );

      expect(records).toHaveLength(limit);
    });

    it('applies Max on a field', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1 };
      const rating2 = { rating: 2 };
      const rating3 = { rating: 15 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Max',
        field: 'rating',
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([{ value: 15, group: {} }]);
    });

    it('applies Max on a field with grouping', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1, message: 'message 1' };
      const rating2 = { rating: 2, message: 'message 1' };
      const rating3 = { rating: 15, message: 'message 2' };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Max',
        field: 'rating',
        groups: [{ field: 'message' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { message: 'message 2' }, value: 15 },
        { group: { message: 'message 1' }, value: 2 },
      ]);
    });

    it('applies Min on a field', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1 };
      const rating2 = { rating: 2 };
      const rating3 = { rating: 15 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Min',
        field: 'rating',
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([{ value: 1, group: {} }]);
    });

    it('applies Min on a field with grouping', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1, message: 'message 1' };
      const rating2 = { rating: 2, message: 'message 1' };
      const rating3 = { rating: 15, message: 'message 2' };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Min',
        field: 'rating',
        groups: [{ field: 'message' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { message: 'message 2' }, value: 15 },
        { group: { message: 'message 1' }, value: 1 },
      ]);
    });

    it('applies Count', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const message1 = { title: 'present', message: 'message 1' };
      const message2 = { title: 'present', message: 'message 2' };
      const message3 = { title: null, message: 'message 3' };
      await review.create(factories.caller.build(), [message1, message1, message2, message3]);

      const aggregation = new Aggregation({
        operation: 'Count',
        field: 'title',
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([{ value: 3, group: {} }]);
    });

    it('applies Count on a field with grouping', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const message1 = { title: 'present', message: 'message 1' };
      const message2 = { title: 'present', message: 'message 2' };
      const message3 = { title: null, message: 'message 3' };
      await review.create(factories.caller.build(), [message1, message1, message2, message3]);

      const aggregation = new Aggregation({
        operation: 'Count',
        field: 'title',
        groups: [{ field: 'message' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { value: 2, group: { message: 'message 1' } },
        { value: 1, group: { message: 'message 2' } },
        { value: 0, group: { message: 'message 3' } },
      ]);
    });

    it('applies Count on the record with grouping', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const message1 = { message: 'message 1' };
      const message2 = { message: 'message 2' };
      await review.create(factories.caller.build(), [message1, message1, message2]);

      const aggregation = new Aggregation({
        operation: 'Count',
        groups: [{ field: 'message' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { value: 2, group: { message: 'message 1' } },
        { value: 1, group: { message: 'message 2' } },
      ]);
    });

    it('applies Count without providing a field', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1 };
      const rating2 = { rating: 2 };
      const rating3 = { rating: 15 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Count',
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([{ value: 3, group: {} }]);
    });

    it('applies Sum on a field', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
      const rating2 = { createdDate: new Date('2022-02-13'), rating: 1 };
      const rating3 = { createdDate: new Date('2023-03-14'), rating: 3 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Sum',
        field: 'rating',
        groups: [{ field: 'createdDate', operation: 'Year' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { createdDate: '2023-01-01' }, value: 3 },
        { group: { createdDate: '2022-01-01' }, value: 6 },
      ]);
    });

    it('applies Sum on a field with grouping and Month operator', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
      const rating2 = { createdDate: new Date('2022-02-13'), rating: 1 };
      const rating3 = { createdDate: new Date('2023-03-14'), rating: 3 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Sum',
        field: 'rating',
        groups: [{ field: 'createdDate', operation: 'Month' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { createdDate: '2022-02-01' }, value: 1 },
        { group: { createdDate: '2023-03-01' }, value: 3 },
        { group: { createdDate: '2022-01-01' }, value: 5 },
      ]);
    });

    it('applies Sum on a field with grouping and Day operator', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
      const rating2 = { createdDate: new Date('2022-02-13'), rating: 1 };
      const rating3 = { createdDate: new Date('2023-03-14'), rating: 3 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Sum',
        field: 'rating',
        groups: [{ field: 'createdDate', operation: 'Day' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { createdDate: '2022-02-13' }, value: 1 },
        { group: { createdDate: '2022-01-13' }, value: 5 },
        { group: { createdDate: '2023-03-14' }, value: 3 },
      ]);
    });

    it('applies Sum on a field with grouping and Week operator', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
      const rating2 = { createdDate: new Date('2022-03-15'), rating: 1 };
      const rating3 = { createdDate: new Date('2022-03-14'), rating: 3 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Sum',
        field: 'rating',
        groups: [{ field: 'createdDate', operation: 'Week' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { createdDate: '2022-01-10' }, value: 5 },
        { group: { createdDate: '2022-03-14' }, value: 4 },
      ]);
    });

    it('applies Avg on a field with grouping and Week operator', async () => {
      connection = await setupReview('collection_aggregate');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
      const rating2 = { createdDate: new Date('2022-03-15'), rating: 1 };
      const rating3 = { createdDate: new Date('2022-03-14'), rating: 3 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Avg',
        field: 'rating',
        groups: [{ field: 'createdDate', operation: 'Week' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { createdDate: '2022-01-10' }, value: 5 },
        { group: { createdDate: '2022-03-14' }, value: (3 + 1) / 2 },
      ]);
    });

    describe('when there are multiple groups', () => {
      it('should apply all the given group', async () => {
        connection = await setupReview('collection_aggregate');
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const message1 = { title: 'title 1', message: 'message 1' };
        const message2 = { title: 'title 1', message: 'message 1' };
        const message3 = { title: 'title 2', message: 'message 1' };
        const message4 = { title: 'title 3', message: 'message 2' };
        await review.create(factories.caller.build(), [message1, message2, message3, message4]);

        const aggregation = new Aggregation({
          operation: 'Count',
          field: 'title',
          groups: [{ field: 'message' }, { field: 'title' }],
        });
        const records = await review.aggregate(
          factories.caller.build(),
          new Filter({}),
          aggregation,
        );

        expect(records).toIncludeSameMembers([
          { value: 2, group: { message: 'message 1', title: 'title 1' } },
          { value: 1, group: { message: 'message 1', title: 'title 2' } },
          { value: 1, group: { message: 'message 2', title: 'title 3' } },
        ]);
      });
    });

    describe('with a many to many', () => {
      it('applies correctly the aggregation', async () => {
        connection = await setupWith2ManyToManyRelations('collection_aggregate');
        const dataSource = new MongooseDatasource(connection);
        const store = dataSource.getCollection('store');
        const owner = dataSource.getCollection('owner');
        const ownerStore = dataSource.getCollection('owner_stores');

        const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
        const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
        await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
        const ownerRecordA = {
          _id: new Types.ObjectId(),
          stores: [storeRecordA._id, storeRecordB._id],
          name: 'owner with the store A and B',
        };
        const ownerRecordB = {
          _id: new Types.ObjectId(),
          stores: [storeRecordB._id],
          name: 'owner with the store B',
        };
        await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

        const aggregation = new Aggregation({
          operation: 'Count',
          groups: [],
        });
        const expectedCount = await ownerStore.aggregate(
          factories.caller.build(),
          factories.filter.build({
            conditionTree: factories.conditionTreeLeaf.build({
              value: storeRecordA._id,
              operator: 'Equal',
              field: 'content',
            }),
          }),
          aggregation,
        );

        expect(expectedCount).toEqual([{ value: 1, group: {} }]);
      });
    });
  });
});
