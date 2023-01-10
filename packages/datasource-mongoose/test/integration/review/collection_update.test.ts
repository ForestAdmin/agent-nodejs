/* eslint-disable no-underscore-dangle */

import { Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Schema, Types } from 'mongoose';

import MongooseDatasource from '../../../src/datasource';
import { setupReview } from '../../_helpers';

describe('MongooseCollection > update', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('should update a record that was just created', async () => {
    // given
    connection = await setupReview('collection_review_update');
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
    connection = await setupReview('collection_review_update');
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

  describe('when update only one record', () => {
    it('should call updateOne hook', async () => {
      connection = await setupReview('collection_review_update');

      const modelSchema = new Schema({
        prop: String,
      });
      const spy = jest.fn();
      modelSchema.pre('updateOne', spy);
      connection.model('aModel', modelSchema);

      const dataSource = new MongooseDatasource(connection);
      const aModel = dataSource.getCollection('aModel');
      const record = { _id: new Types.ObjectId(), prop: 'a old prop' };
      await aModel.create(factories.caller.build(), [record]);
      // when
      await aModel.update(factories.caller.build(), new Filter({}), { prop: 'new prop' });

      // then
      expect(spy).toHaveBeenCalled();
    });

    describe('on a flattened model', () => {
      it('should call updateOne hook of the parent model', async () => {
        connection = await setupReview('collection_review_update');

        const modelSchema = new Schema({
          nested: {
            nestProp: String,
          },
        });
        const spy = jest.fn();
        modelSchema.pre('updateOne', spy);
        connection.model('aModel', modelSchema);

        const dataSource = new MongooseDatasource(connection, { asModels: { aModel: ['nested'] } });
        await connection.models.aModel.create({
          nested: { nestProp: 'a old nested prop' },
        });

        // when
        await dataSource
          .getCollection('aModel_nested')
          .update(factories.caller.build(), new Filter({}), { nestProp: 'new nested prop' });

        // then
        expect(spy).toHaveBeenCalled();
      });
    });
  });

  describe('when update more than one record', () => {
    it('should call updateMany hook', async () => {
      connection = await setupReview('collection_review_update');

      const modelSchema = new Schema({
        prop: String,
        key: String,
      });
      const spy = jest.fn();
      modelSchema.pre('updateMany', spy);
      connection.model('aModel', modelSchema);

      const dataSource = new MongooseDatasource(connection);
      const aModel = dataSource.getCollection('aModel');
      const record = { _id: new Types.ObjectId(), prop: 'a old prop', key: 'the key' };
      const record2 = { _id: new Types.ObjectId(), prop: 'another old prop', key: 'the key' };
      await aModel.create(factories.caller.build(), [record, record2]);

      // when
      await aModel.update(factories.caller.build(), new Filter({}), { prop: 'new prop' });

      // then
      const updatedRecords = await aModel.list(
        factories.caller.build(),
        new Filter({}),
        new Projection('prop'),
      );
      expect(updatedRecords).toEqual([{ prop: 'new prop' }, { prop: 'new prop' }]);

      expect(spy).toHaveBeenCalled();
    });

    describe('on a flattened model', () => {
      it('should call updateMany hook of the parent model', async () => {
        connection = await setupReview('collection_review_update');

        const modelSchema = new Schema({
          nested: {
            nestProp: String,
          },
        });
        const spy = jest.fn();
        modelSchema.pre('updateMany', spy);
        connection.model('aModel', modelSchema);

        const dataSource = new MongooseDatasource(connection, { asModels: { aModel: ['nested'] } });
        await connection.models.aModel.create({
          nested: { nestProp: 'a old nested prop' },
        });
        await connection.models.aModel.create({
          nested: { nestProp: 'another old nested prop' },
        });

        const collection = dataSource.getCollection('aModel_nested');
        // when
        await collection.update(factories.caller.build(), new Filter({}), {
          nestProp: 'new nested prop',
        });

        // then
        const updatedRecords = await collection.list(
          factories.caller.build(),
          new Filter({}),
          new Projection('nestProp'),
        );
        expect(updatedRecords).toEqual([
          { nestProp: 'new nested prop' },
          { nestProp: 'new nested prop' },
        ]);

        expect(spy).toHaveBeenCalled();
      });
    });
  });
});
