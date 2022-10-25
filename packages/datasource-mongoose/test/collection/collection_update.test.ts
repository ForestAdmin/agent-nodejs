/* eslint-disable no-underscore-dangle */

import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';
import { Filter, Projection } from '@forestadmin/datasource-toolkit';

import { setupReview, setupWith2ManyToManyRelations } from '../_helpers';
import MongooseDatasource from '../../src/datasource';

describe('MongooseCollection > update', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('should update a record that was just created', async () => {
    // given
    connection = await setupReview('collection_update');
    const dataSource = new MongooseDatasource(connection);
    const review = dataSource.getCollection('review');
    const record = { _id: new Types.ObjectId(), message: 'old message' };
    await review.create(factories.caller.build(), [record]);

    const filter = factories.filter.build({
      conditionTree: factories.conditionTreeLeaf.build({
        field: '_id',
        value: record._id,
        operator: 'Equal',
      }),
    });

    // when
    await review.update(factories.caller.build(), filter, { message: 'new message' });

    // then
    const updatedRecord = await review.list(
      factories.caller.build(),
      filter,
      new Projection('message'),
    );
    expect(updatedRecord).toEqual([{ message: 'new message' }]);
  });

  it('should update a field within a flattened nested document (and only this one)', async () => {
    /** **************************************************** */
    /* Regression test for https://app.clickup.com/t/36fcjhz */
    /** **************************************************** */

    // Setup
    connection = await setupReview('collection_update');
    const options = { asModels: { review: ['nestedField'] } };
    const dataSource = new MongooseDatasource(connection, options);

    // Create a review by querying mongoose directly
    const { id } = await connection.models.review.create({
      nestedField: {
        nested: [{ level: 1 }, { level: 2 }],
        other: 'something',
      },
    });

    // Trigger an update on the nested field by querying the flattened collection.
    await dataSource
      .getCollection('review_nestedField')
      .update(factories.caller.build(), new Filter({}), { other: 'new value' });

    // Check that the update was correctly applied.
    const updatedRecord = await connection.models.review.findById(id);

    expect(updatedRecord).toMatchObject({
      nestedField: {
        nested: [{ level: 1 }, { level: 2 }], // this should not get overwritten
        other: 'new value', // this should get overwritten
      },
    });
  });

  it('should update a value in array of objectids (used for a many to many relation)', async () => {
    // given
    connection = await setupWith2ManyToManyRelations('collection_update');
    const dataSource = new MongooseDatasource(connection);
    const store = dataSource.getCollection('store');
    const owner = dataSource.getCollection('owner');
    const ownerStore = dataSource.getCollection('owner_stores');

    const storeRecordA = { _id: new Types.ObjectId().toString(), name: 'A' };
    const storeRecordB = { _id: new Types.ObjectId().toString(), name: 'B' };
    await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
    const ownerRecordA = { _id: new Types.ObjectId().toString(), stores: [storeRecordA._id] };
    const ownerRecordB = { _id: new Types.ObjectId().toString() };
    await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

    // when
    await ownerStore.update(
      factories.caller.build(),
      new Filter({
        conditionTree: factories.conditionTreeBranch.build({
          aggregator: 'And',
          conditions: [
            factories.conditionTreeLeaf.build({
              value: ownerRecordA._id,
              operator: 'Equal',
              field: '_pid',
            }),
            factories.conditionTreeLeaf.build({
              value: storeRecordA._id,
              operator: 'Equal',
              field: 'content',
            }),
          ],
        }),
      }),
      { _pid: ownerRecordA._id, content: storeRecordB._id },
    );

    // then

    const expectedOwnerStore = await ownerStore.list(
      factories.caller.build(),
      factories.filter.build(),
      new Projection('_pid', 'content'),
    );
    expect(expectedOwnerStore).toEqual([{ _pid: ownerRecordA._id, content: storeRecordB._id }]);
  });
});
