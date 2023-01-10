/* eslint-disable no-underscore-dangle */

import { Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import MongooseDatasource from '../../../src/datasource';
import { setupWith2ManyToManyRelations } from '../../_helpers';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('applies correctly the condition tree', async () => {
    connection = await setupWith2ManyToManyRelations('collection_m2m_list');
    const dataSource = new MongooseDatasource(connection);
    const store = dataSource.getCollection('store');
    const owner = dataSource.getCollection('owner');
    const ownerStore = dataSource.getCollection('owner_stores');

    const storeRecordA = { _id: new Types.ObjectId().toString(), name: 'A' };
    const storeRecordB = { _id: new Types.ObjectId().toString(), name: 'B' };
    await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
    const ownerRecordA = {
      _id: new Types.ObjectId().toString(),
      stores: [storeRecordA._id, storeRecordB._id],
      name: 'owner with the store A and B',
    };
    const ownerRecordB = {
      _id: new Types.ObjectId().toString(),
      stores: [storeRecordB._id],
      name: 'owner with the store B',
    };
    await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

    const expectedOwner = await ownerStore.list(
      factories.caller.build(),
      factories.filter.build({
        conditionTree: factories.conditionTreeLeaf.build({
          value: storeRecordA._id,
          operator: 'Equal',
          field: 'content',
        }),
      }),
      new Projection('content'),
    );

    expect(expectedOwner).toEqual([{ content: storeRecordA._id }]);
  });
});
