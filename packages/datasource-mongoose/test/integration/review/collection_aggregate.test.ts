/* eslint-disable no-underscore-dangle */

import { Aggregation, Collection, DataSource, Filter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection } from 'mongoose';

import MongooseDatasource from '../../../src/datasource';
import { setupReview } from '../_helpers';

describe('MongooseCollection', () => {
  let connection: Connection;
  let dataSource: DataSource;
  let review: Collection;

  beforeEach(async () => {
    connection = await setupReview('collection_review_aggregate');
    dataSource = new MongooseDatasource(connection);
    review = dataSource.getCollection('review');
  });

  afterEach(async () => {
    await connection?.close();
  });

  it('applies Limit on the results', async () => {
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
    const rating1 = { rating: 1 };
    const rating2 = { rating: 2 };
    const rating3 = { rating: 15 };
    await review.create(factories.caller.build(), [rating1, rating2, rating3]);

    const aggregation = new Aggregation({
      operation: 'Max',
      field: 'rating',
    });
    const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

    expect(records).toStrictEqual([{ value: 15, group: {} }]);
  });

  it('applies Max on a field with grouping', async () => {
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

    expect(records).toStrictEqual([
      { group: { message: 'message 2' }, value: 15 },
      { group: { message: 'message 1' }, value: 2 },
    ]);
  });

  it('applies Min on a field', async () => {
    const rating1 = { rating: 1 };
    const rating2 = { rating: 2 };
    const rating3 = { rating: 15 };
    await review.create(factories.caller.build(), [rating1, rating2, rating3]);

    const aggregation = new Aggregation({
      operation: 'Min',
      field: 'rating',
    });
    const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

    expect(records).toStrictEqual([{ value: 1, group: {} }]);
  });

  it('applies Min on a field with grouping', async () => {
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

    expect(records).toStrictEqual([
      { group: { message: 'message 2' }, value: 15 },
      { group: { message: 'message 1' }, value: 1 },
    ]);
  });

  it('applies Count', async () => {
    const message1 = { title: 'present', message: 'message 1' };
    const message2 = { title: 'present', message: 'message 2' };
    const message3 = { title: null, message: 'message 3' };
    await review.create(factories.caller.build(), [message1, message1, message2, message3]);

    const aggregation = new Aggregation({
      operation: 'Count',
      field: 'title',
    });
    const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

    expect(records).toStrictEqual([{ value: 3, group: {} }]);
  });

  it('applies Count on a field with grouping', async () => {
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

    expect(records).toStrictEqual([
      { value: 2, group: { message: 'message 1' } },
      { value: 1, group: { message: 'message 2' } },
      { value: 0, group: { message: 'message 3' } },
    ]);
  });

  it('applies Count on the record with grouping', async () => {
    const message1 = { message: 'message 1' };
    const message2 = { message: 'message 2' };
    await review.create(factories.caller.build(), [message1, message1, message2]);

    const aggregation = new Aggregation({
      operation: 'Count',
      groups: [{ field: 'message' }],
    });
    const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

    expect(records).toStrictEqual([
      { value: 2, group: { message: 'message 1' } },
      { value: 1, group: { message: 'message 2' } },
    ]);
  });

  it('applies Count without providing a field', async () => {
    const rating1 = { rating: 1 };
    const rating2 = { rating: 2 };
    const rating3 = { rating: 15 };
    await review.create(factories.caller.build(), [rating1, rating2, rating3]);

    const aggregation = new Aggregation({
      operation: 'Count',
    });
    const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

    expect(records).toStrictEqual([{ value: 3, group: {} }]);
  });

  it('applies Sum on a field', async () => {
    const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
    const rating3 = { createdDate: new Date('2023-03-14'), rating: 3 };
    const rating2 = { createdDate: new Date('2022-02-13'), rating: 1 };
    await review.create(factories.caller.build(), [rating1, rating2, rating3]);

    const aggregation = new Aggregation({
      operation: 'Sum',
      field: 'rating',
      groups: [{ field: 'createdDate', operation: 'Year' }],
    });
    const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

    expect(records).toStrictEqual([
      { group: { createdDate: '2022-01-01' }, value: 6 },
      { group: { createdDate: '2023-01-01' }, value: 3 },
    ]);
  });

  it('applies Sum on a field with grouping and Month operator', async () => {
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

    expect(records).toStrictEqual([
      { group: { createdDate: '2022-01-01' }, value: 5 },
      { group: { createdDate: '2023-03-01' }, value: 3 },
      { group: { createdDate: '2022-02-01' }, value: 1 },
    ]);
  });

  it('applies Sum on a field with grouping and Day operator', async () => {
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

    expect(records).toStrictEqual([
      { group: { createdDate: '2022-01-13' }, value: 5 },
      { group: { createdDate: '2023-03-14' }, value: 3 },
      { group: { createdDate: '2022-02-13' }, value: 1 },
    ]);
  });

  it('applies Sum on a field with grouping and Week operator', async () => {
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

    expect(records).toStrictEqual([
      { group: { createdDate: '2022-01-10' }, value: 5 },
      { group: { createdDate: '2022-03-14' }, value: 4 },
    ]);
  });

  it('applies Avg on a field with grouping and Week operator', async () => {
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

    expect(records).toStrictEqual([
      { group: { createdDate: '2022-01-10' }, value: 5 },
      { group: { createdDate: '2022-03-14' }, value: (3 + 1) / 2 },
    ]);
  });

  describe('when there are multiple groups', () => {
    it('should apply all the given group', async () => {
      const msg1 = { title: 'title 1', message: 'message 1' };
      const msg2 = { title: 'title 2', message: 'message 1' };
      const msg3 = { title: 'title 3', message: 'message 2' };
      await review.create(factories.caller.build(), [msg1, msg1, msg1, msg2, msg2, msg3]);

      const aggregation = new Aggregation({
        operation: 'Count',
        field: 'title',
        groups: [{ field: 'message' }, { field: 'title' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toStrictEqual([
        { value: 3, group: { message: 'message 1', title: 'title 1' } },
        { value: 2, group: { message: 'message 1', title: 'title 2' } },
        { value: 1, group: { message: 'message 2', title: 'title 3' } },
      ]);
    });
  });
});
