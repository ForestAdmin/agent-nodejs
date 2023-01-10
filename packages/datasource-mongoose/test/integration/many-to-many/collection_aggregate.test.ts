/* eslint-disable no-underscore-dangle */

import { Aggregation } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import MongooseDatasource from '../../../src/datasource';
import { setupWith2ManyToManyRelations } from '../../_helpers';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('applies correctly the aggregation', async () => {
    connection = await setupWith2ManyToManyRelations('collection_m2m_aggregate');
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
