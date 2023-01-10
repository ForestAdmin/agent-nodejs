/* eslint-disable no-underscore-dangle */

import { Projection, Sort } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import MongooseDatasource from '../../../src/datasource';
import { setupWithManyToOneRelation } from '../../_helpers';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('applies correctly the sort when it sorts on a relation field', async () => {
    connection = await setupWithManyToOneRelation('collection_m2o_list');
    const dataSource = new MongooseDatasource(connection);
    const store = dataSource.getCollection('store');
    const owner = dataSource.getCollection('owner');

    const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
    const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
    await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
    const ownerRecordA = {
      _id: new Types.ObjectId(),
      storeId: storeRecordA._id,
      name: 'the second',
    };
    const ownerRecordB = {
      _id: new Types.ObjectId(),
      storeId: storeRecordB._id,
      name: 'the first',
    };
    await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

    const expectedOwner = await owner.list(
      factories.caller.build(),
      factories.filter.build({
        sort: new Sort({ field: 'storeId__manyToOne:name', ascending: false }),
      }),
      new Projection('name'),
    );

    expect(expectedOwner).toEqual([{ name: 'the first' }, { name: 'the second' }]);
  });

  it('should return empty records', async () => {
    connection = await setupWithManyToOneRelation('collection_m2o_list');
    const dataSource = new MongooseDatasource(connection);
    const store = dataSource.getCollection('store');
    const owner = dataSource.getCollection('owner');

    const storeRecord = { _id: new Types.ObjectId(), name: 'aStore' };
    await store.create(factories.caller.build(), [storeRecord]);
    const ownerRecord = {
      _id: new Types.ObjectId(),
      storeId: storeRecord._id,
      name: 'aOwner',
    };
    await owner.create(factories.caller.build(), [ownerRecord]);

    const expectedOwner = await owner.list(
      factories.caller.build(),
      factories.filter.build(),
      new Projection(),
    );

    expect(expectedOwner).toEqual([{}]);
  });

  it('should fetch relation (when defined)', async () => {
    connection = await setupWithManyToOneRelation('collection_m2o_list');
    const dataSource = new MongooseDatasource(connection);
    const store = dataSource.getCollection('store');
    const owner = dataSource.getCollection('owner');

    const storeRecord = { _id: new Types.ObjectId(), name: 'aStore' };
    await store.create(factories.caller.build(), [storeRecord]);
    const ownerRecord = {
      _id: new Types.ObjectId(),
      storeId: storeRecord._id,
      name: 'aOwner',
    };
    await owner.create(factories.caller.build(), [ownerRecord]);

    const expectedOwner = await owner.list(
      factories.caller.build(),
      factories.filter.build(),
      new Projection('name', 'storeId__manyToOne:name'),
    );

    expect(expectedOwner).toEqual([{ name: 'aOwner', storeId__manyToOne: { name: 'aStore' } }]);
  });

  it('should return null when relation is not set', async () => {
    connection = await setupWithManyToOneRelation('collection_m2o_list');
    const dataSource = new MongooseDatasource(connection);
    const store = dataSource.getCollection('store');
    const owner = dataSource.getCollection('owner');

    const storeRecord = { _id: new Types.ObjectId(), name: 'aStore' };
    await store.create(factories.caller.build(), [storeRecord]);
    const ownerRecord = {
      _id: new Types.ObjectId(),
      storeId: null,
      name: 'aOwner',
    };
    await owner.create(factories.caller.build(), [ownerRecord]);

    const expectedOwner = await owner.list(
      factories.caller.build(),
      factories.filter.build(),
      new Projection('name', 'storeId__manyToOne:name'),
    );

    expect(expectedOwner).toEqual([{ name: 'aOwner' }]);
  });

  it('should filter by relation', async () => {
    connection = await setupWithManyToOneRelation('collection_m2o_list');
    const dataSource = new MongooseDatasource(connection);
    const store = dataSource.getCollection('store');
    const owner = dataSource.getCollection('owner');

    const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
    const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
    await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
    const ownerRecordA = {
      _id: new Types.ObjectId(),
      storeId: storeRecordA._id,
      name: 'owner with the store A',
    };
    const ownerRecordB = {
      _id: new Types.ObjectId(),
      storeId: storeRecordB._id,
      name: 'owner with the store B',
    };
    await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

    const expectedOwner = await owner.list(
      factories.caller.build(),
      factories.filter.build({
        conditionTree: factories.conditionTreeLeaf.build({
          value: 'A',
          operator: 'Equal',
          field: 'storeId__manyToOne:name',
        }),
      }),
      new Projection('name'),
    );

    expect(expectedOwner).toEqual([{ name: 'owner with the store A' }]);
  });

  it('should filter by nested relation', async () => {
    connection = await setupWithManyToOneRelation('collection_m2o_list');
    const dataSource = new MongooseDatasource(connection);
    const store = dataSource.getCollection('store');
    const owner = dataSource.getCollection('owner');
    const address = dataSource.getCollection('address');

    const addressRecordA = { _id: new Types.ObjectId().toString(), name: 'A' };
    const addressRecordB = { _id: new Types.ObjectId().toString(), name: 'B' };
    await address.create(factories.caller.build(), [addressRecordA, addressRecordB]);

    const storeRecordA = {
      _id: new Types.ObjectId().toString(),
      name: 'A',
      addressId: addressRecordA._id,
    };
    const storeRecordB = {
      _id: new Types.ObjectId().toString(),
      name: 'B',
      addressId: addressRecordB._id,
    };
    await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);

    const ownerRecordA = {
      _id: new Types.ObjectId().toString(),
      storeId: storeRecordA._id,
      name: 'owner with the store address A',
    };
    const ownerRecordB = {
      _id: new Types.ObjectId().toString(),
      storeId: storeRecordB._id,
      name: 'owner with the store address B',
    };
    await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

    const expectedOwner = await owner.list(
      factories.caller.build(),
      factories.filter.build({
        conditionTree: factories.conditionTreeLeaf.build({
          value: 'A',
          operator: 'Equal',
          field: 'storeId__manyToOne:addressId__manyToOne:name',
        }),
      }),
      new Projection(
        '_id',
        'storeId',
        'name',
        'storeId__manyToOne:_id',
        'storeId__manyToOne:name',
        'storeId__manyToOne:addressId',
        'storeId__manyToOne:addressId__manyToOne:_id',
        'storeId__manyToOne:addressId__manyToOne:name',
      ),
    );

    expect(expectedOwner).toEqual([
      {
        _id: expect.any(String),
        storeId: expect.any(String),
        name: 'owner with the store address A',
        storeId__manyToOne: {
          _id: expect.any(String),
          name: 'A',
          addressId: expect.any(String),
          addressId__manyToOne: {
            _id: expect.any(String),
            name: 'A',
          },
        },
      },
    ]);
  });
});
