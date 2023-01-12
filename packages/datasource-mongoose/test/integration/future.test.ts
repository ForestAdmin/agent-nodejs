/* eslint-disable no-underscore-dangle */
/* eslint-disable jest/no-disabled-tests */

import { Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import { setupWith2ManyToManyRelations } from './_build-models';
import MongooseDatasource from '../../src/datasource';

describe('Tests for future versions', () => {
  let connection: Connection;

  describe('When transforming an object to a model', () => {
    /**
     * We have books with the following structure:
     * { title: 'foundation', author: { firstname: 'isaac', lastname: 'asimov' } }
     *
     * We want to test that create/update behaves correctly for the `books_author` collection.
     */

    it.todo('The submodels should list only records where the parent is non null');
    it.todo('create should fail on the submodel if it is going to overwrite data');
  });

  describe('When transforming nested array into models', () => {
    /**
     * We have accounts with the following structure:
     *
     * { name: 'john doe', bills: [{ items: [{ amount: Number }] }] }
     */

    it.todo('should allow to delete an item within a particular bill');
  });

  describe('When transforming an array to a model', () => {
    /**
     * We have owners and stores with the following structure
     *
     * owners: { name: 'Something', stores: [1, 2, 3]}
     * stores: { id: 1, name: 'xx' }
     *
     * We want to test that create/update behaves correctly for the `owners_stores` collection.
     */

    it.skip('update parentId on virtual model', async () => {
      // given
      connection = await setupWith2ManyToManyRelations('collection_create');
      const dataSource = new MongooseDatasource(connection);
      const store = dataSource.getCollection('store');
      const owner = dataSource.getCollection('owner');
      const ownerStore = dataSource.getCollection('owner_stores');

      const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
      const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
      await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
      const ownerRecordA = { _id: new Types.ObjectId(), stores: [storeRecordA._id] };
      const ownerRecordB = { _id: new Types.ObjectId() };
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
                field: 'parentId',
              }),
              factories.conditionTreeLeaf.build({
                value: storeRecordA._id,
                operator: 'Equal',
                field: 'content',
              }),
            ],
          }),
        }),

        { parentId: ownerRecordA._id, content: storeRecordB._id },
      );

      // then

      const expectedOwnerStore = await ownerStore.list(
        factories.caller.build(),
        factories.filter.build(),
        new Projection('content', 'parentId'),
      );
      expect(expectedOwnerStore).toEqual([
        { parentId: ownerRecordA._id, content: storeRecordB._id },
      ]);
    });

    it.skip('update parentId and content on virtual model', async () => {
      // given
      connection = await setupWith2ManyToManyRelations('collection_update');
      const dataSource = new MongooseDatasource(connection);
      const store = dataSource.getCollection('store');
      const owner = dataSource.getCollection('owner');
      const ownerStore = dataSource.getCollection('owner_stores');

      const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
      const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
      await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);

      const ownerRecordA = { _id: new Types.ObjectId(), stores: [storeRecordA._id] };
      const ownerRecordB = { _id: new Types.ObjectId() };
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
                field: 'parentId',
              }),
              factories.conditionTreeLeaf.build({
                value: storeRecordA._id,
                operator: 'Equal',
                field: 'content',
              }),
            ],
          }),
        }),

        { parentId: ownerRecordB._id, content: storeRecordB._id },
      );

      // then

      const expectedOwnerStore = await ownerStore.list(
        factories.caller.build(),
        factories.filter.build(),
        new Projection('parentId', 'content'),
      );
      expect(expectedOwnerStore).toEqual([
        { parentId: ownerRecordB._id, content: storeRecordB._id },
      ]);
    });
  });
});
