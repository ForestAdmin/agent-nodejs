/* eslint-disable no-underscore-dangle */

import { Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import setupWith2ManyToManyRelations from './_build-models';
import MongooseDatasource from '../../../src/datasource';

const caller = factories.caller.build();

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('adds the right id to the right record', async () => {
    // given
    connection = await setupWith2ManyToManyRelations('collection_m2m_create');
    const dataSource = new MongooseDatasource(connection);
    const store = dataSource.getCollection('store');
    const owner = dataSource.getCollection('owner');
    const ownerStore = dataSource.getCollection('owner_stores');

    const storeRecordA = { _id: new Types.ObjectId().toString(), name: 'A' };
    const storeRecordB = { _id: new Types.ObjectId().toString(), name: 'B' };
    await store.create(caller, [storeRecordA, storeRecordB]);

    const ownerRecordA = { _id: new Types.ObjectId().toString(), stores: [storeRecordA._id] };
    const ownerRecordB = { _id: new Types.ObjectId().toString() };
    await owner.create(caller, [ownerRecordA, ownerRecordB]);

    // when
    await ownerStore.create(caller, [{ parentId: ownerRecordB._id, content: storeRecordB._id }]);

    // then
    const expectedOwnerStore = await ownerStore.list(
      caller,
      factories.filter.build(),
      new Projection('content', 'parentId'),
    );
    expect(expectedOwnerStore).toEqual([
      { parentId: ownerRecordA._id, content: storeRecordA._id },
      { parentId: ownerRecordB._id, content: storeRecordB._id },
    ]);
  });
});
