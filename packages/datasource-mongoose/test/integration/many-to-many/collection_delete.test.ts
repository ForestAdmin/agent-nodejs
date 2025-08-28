/* eslint-disable no-underscore-dangle */

import { Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import setupWith2ManyToManyRelations from './_build-models';
import MongooseDatasource from '../../../src/datasource';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('delete an element within an array', async () => {
    // given
    connection = await setupWith2ManyToManyRelations('collection_m2m_delete');
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
    );

    // then
    const expectedOwnerStore = await ownerStore.list(
      factories.caller.build(),
      factories.filter.build(),
      new Projection(),
    );

    expect(expectedOwnerStore).toEqual([]);
  });

  describe('with flattenMode auto', () => {
    it('delete an element within a nested array', async () => {
      // given
      connection = await setupWith2ManyToManyRelations('collection_m2m_delete');
      const dataSource = new MongooseDatasource(connection, { flattenMode: 'auto' });

      const owner = dataSource.getCollection('owner');
      const ownerPrograms = dataSource.getCollection('owner_programs');
      const ownerProgramsActivities = dataSource.getCollection('owner_programs_activities');

      const [ownerRecord] = await owner.create(factories.caller.build(), [{ name: 'owner' }]);

      const [ownerProgramsRecord] = await ownerPrograms.create(factories.caller.build(), [
        { label: 'prog', parentId: ownerRecord._id },
      ]);

      const [recordToDelete] = await ownerProgramsActivities.create(factories.caller.build(), [
        {
          label: 'activity a',
          order: 1,
          parentId: ownerProgramsRecord._id,
        },
        {
          label: 'activity b',
          order: 2,
          parentId: ownerProgramsRecord._id,
        },
      ]);

      // when
      await ownerProgramsActivities.delete(
        factories.caller.build(),
        new Filter({
          conditionTree: factories.conditionTreeLeaf.build({
            value: recordToDelete._id,
            operator: 'Equal',
            field: '_id',
          }),
        }),
      );

      // then
      const expectedOwnerProgramsActivities = await ownerProgramsActivities.list(
        factories.caller.build(),
        factories.filter.build(),
        new Projection('programs'),
      );

      expect(expectedOwnerProgramsActivities).toHaveLength(1);
    });
  });
});
