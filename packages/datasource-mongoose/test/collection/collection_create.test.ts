/* eslint-disable no-underscore-dangle */
/* eslint-disable jest/no-disabled-tests */

import { Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import MongooseDatasource from '../../src/datasource';
import { setupReview, setupWith2ManyToManyRelations } from '../_helpers';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  describe('create', () => {
    it('should return the list of the created records', async () => {
      connection = await setupReview('collection_create');
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const expectedRecord = {
        message: 'a message',
        title: 'a title',
        tags: ['A'],
        modificationDates: [],
        editorIds: [],
      };

      const records = await review.create(factories.caller.build(), [
        expectedRecord,
        expectedRecord,
        expectedRecord,
      ]);

      expect(records).toEqual([
        { ...expectedRecord, _id: expect.any(Object) },
        { ...expectedRecord, _id: expect.any(Object) },
        { ...expectedRecord, _id: expect.any(Object) },
      ]);
      const persistedRecord = await connection.models.review.find();
      expect(persistedRecord).toHaveLength(3);
    });

    it('should throw on nested collection if parentId is missing', async () => {
      connection = await setupReview('collection_create');

      const dataSource = new MongooseDatasource(connection, { asModels: { review: ['message'] } });
      const reviews = dataSource.getCollection('review');
      const reviewMessages = dataSource.getCollection('review_message');

      await reviews.create(null, [
        {
          message: 'a message',
          title: 'a title',
          tags: ['A'],
          modificationDates: [],
          editorIds: [],
        },
      ]);

      const handler = () => reviewMessages.create(null, [{ content: 'something' }]);
      await expect(handler).rejects.toThrow('Trying to create a subrecord with no parent');
    });

    describe('when there are nested records', () => {
      it('returns the created nested records without the mongoose _id', async () => {
        connection = await setupReview('collection_create');
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const data = {
          message: 'a message',
          title: 'a title',
          nestedField: { nested: [{ level: 10 }] },
        };

        const records = await review.create(factories.caller.build(), [data, data, data]);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        expect(records[0].nestedField.nested).toEqual([{ level: 10 }]);

        const persistedRecord = await connection.models.review.find();
        expect(persistedRecord).toHaveLength(3);
      });

      describe('when the nested record is a JSON', () => {
        it('returns the list of the created nested records', async () => {
          connection = await setupReview('collection_create');
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          const data = {
            message: 'a message',
            title: 'a title',
            nestedField: { nested: [{ level: 10 }] },
          };

          const records = await review.create(factories.caller.build(), [data, data, data]);

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          expect(records[0].nestedField.nested).toEqual([{ level: 10 }]);

          const persistedRecord = await connection.models.review.find();
          expect(persistedRecord).toHaveLength(3);
        });
      });
    });

    describe('with a many to many relation', () => {
      describe('with a many to many collection', () => {
        it('adds the right id to the right record', async () => {
          // given
          connection = await setupWith2ManyToManyRelations('collection_create');
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
          await ownerStore.create(factories.caller.build(), [
            { _pid: ownerRecordB._id, content: storeRecordB._id },
          ]);

          // then
          const expectedOwnerStore = await ownerStore.list(
            factories.caller.build(),
            factories.filter.build(),
            new Projection('content', '_pid'),
          );
          expect(expectedOwnerStore).toEqual([
            { _pid: ownerRecordA._id, content: storeRecordA._id },
            { _pid: ownerRecordB._id, content: storeRecordB._id },
          ]);
        });
      });
    });
  });
});
