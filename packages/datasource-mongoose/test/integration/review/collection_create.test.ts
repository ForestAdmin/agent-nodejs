/* eslint-disable no-underscore-dangle */

import { ValidationError } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection } from 'mongoose';

import MongooseDatasource from '../../../src/datasource';
import { setupReview } from '../../_helpers';

const caller = factories.caller.build();

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('should throw a validation error when the validation fails', async () => {
    connection = await setupReview('collection_review_create');
    const dataSource = new MongooseDatasource(connection);
    const review = dataSource.getCollection('review');

    await expect(
      review.create(factories.caller.build(), [{ title: 'forbidden title' }]),
    ).rejects.toThrowError(ValidationError);
  });

  it('should return the list of the created records', async () => {
    connection = await setupReview('collection_review_create');
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
    connection = await setupReview('collection_review_create');

    const dataSource = new MongooseDatasource(connection, { asModels: { review: ['message'] } });
    const reviews = dataSource.getCollection('review');
    const reviewMessages = dataSource.getCollection('review_message');

    await reviews.create(caller, [
      {
        message: 'a message',
        title: 'a title',
        tags: ['A'],
        modificationDates: [],
        editorIds: [],
      },
    ]);

    const handler = () => reviewMessages.create(caller, [{ content: 'something' }]);
    await expect(handler).rejects.toThrow('Trying to create a subrecord with no parent');
  });

  describe('when there are nested records', () => {
    it('returns the created nested records without the mongoose _id', async () => {
      connection = await setupReview('collection_review_create');
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
        connection = await setupReview('collection_review_create');
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const data = {
          message: 'a message',
          title: 'a title',
          nestedField: { nested: [{ level: 10 }] },
        };

        const records = await review.create(factories.caller.build(), [data, data, data]);
        expect(records[0].nestedField.nested).toEqual([{ level: 10 }]);

        const persistedRecord = await connection.models.review.find();
        expect(persistedRecord).toHaveLength(3);
      });
    });
  });
});
