/* eslint-disable no-underscore-dangle */

import { Caller, Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Schema, Types } from 'mongoose';

import setupReview from './_build-models';
import MongooseDatasource from '../../../src/datasource';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('Delete a record', async () => {
    // given
    connection = await setupReview('collection_review_delete');
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
    connection = await setupReview('collection_review_delete');
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
});
