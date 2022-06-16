/* eslint-disable no-underscore-dangle */

import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';
import { Filter, Projection } from '@forestadmin/datasource-toolkit';

import { setupReview, setupWith2ManyToManyRelations } from '../_helpers';
import MongooseDatasource from '../../src/datasource';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  describe('update', () => {
    it('should update the created record', async () => {
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

    describe('with a many to many relation', () => {
      describe('when there is the foreign relation to update', () => {
        it('updates the right id in the array of objectId', async () => {
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
          expect(expectedOwnerStore).toEqual([
            { _pid: ownerRecordA._id, content: storeRecordB._id },
          ]);
        });
      });
    });
  });
});
