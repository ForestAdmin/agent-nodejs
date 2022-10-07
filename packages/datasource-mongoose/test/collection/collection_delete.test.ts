/* eslint-disable no-underscore-dangle */

import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Caller, Filter, Projection } from '@forestadmin/datasource-toolkit';
import { Connection, Schema, Types } from 'mongoose';

import { setupReview, setupWith2ManyToManyRelations } from '../_helpers';
import MongooseDatasource from '../../src/datasource';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('Delete a record', async () => {
    // given
    connection = await setupReview('collection_delete');
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
    await review.delete(factories.caller.build(), filter);

    // then
    const updatedRecord = await review.list(factories.caller.build(), filter, new Projection());
    expect(updatedRecord).toEqual([]);
  });

  it('delete a subrecord', async () => {
    // Create collection
    connection = await setupReview('collection_delete');
    connection.model<unknown>(
      'books',
      new Schema({ author: { firstname: String, lastname: String } }),
    );

    // Create record
    const oldRecord = await connection
      .model<unknown>('books')
      .create({ author: { firstname: 'isaac', lastname: 'asimov' } });

    // Delete subrecordx
    const dataSource = new MongooseDatasource(connection, { asModels: { books: ['author'] } });
    await dataSource.getCollection('books_author').delete({} as Caller, new Filter({}));

    // Check that it was deleted for real
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newRecord = await connection
      .model<{ author: { firstname: string; lastname: string } }>('books')
      .findById(oldRecord._id);
    expect(newRecord?.author?.firstname).toBe(undefined);
    expect(newRecord?.author?.lastname).toBe(undefined);
  });

  it('delete an element within an array', async () => {
    // given
    connection = await setupWith2ManyToManyRelations('collection_delete');
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
    await ownerStore.delete(
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
    );

    // then
    const expectedOwnerStore = await ownerStore.list(
      factories.caller.build(),
      factories.filter.build(),
      new Projection(),
    );

    expect(expectedOwnerStore).toEqual([]);
  });
});
