/* eslint-disable no-underscore-dangle */

import { Aggregation, Collection, DataSource, Filter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import setupWithManyToOneRelation from './_build-models';
import MongooseDatasource from '../../../src/datasource';

describe('MongooseCollection', () => {
  let connection: Connection;
  let dataSource: DataSource;
  let store: Collection;
  let owner: Collection;

  beforeEach(async () => {
    connection = await setupWithManyToOneRelation('collection_m2o_aggregate');
    dataSource = new MongooseDatasource(connection);
    store = dataSource.getCollection('store');
    owner = dataSource.getCollection('owner');
  });

  afterEach(async () => {
    await connection?.close();
  });

  it('applies an aggregation operator on a relation field', async () => {
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

    expect(records).toStrictEqual([{ value: 'B', group: {} }]);
  });

  it('applies a group on a relation field', async () => {
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

    expect(records).toStrictEqual([
      { group: { 'storeId__manyToOne:name': 'A' }, value: 2 },
      { group: { 'storeId__manyToOne:name': 'B' }, value: 1 },
    ]);
  });
});
