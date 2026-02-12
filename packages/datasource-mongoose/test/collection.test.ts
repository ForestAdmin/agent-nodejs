/* eslint-disable no-underscore-dangle */
/* eslint-disable jest/no-disabled-tests */

import type { Connection, Model } from 'mongoose';

import { Schema, model } from 'mongoose';

import MongooseCollection from '../src/collection';
import MongooseDatasource from '../src/datasource';

describe('MongooseCollection', () => {
  it('should build a collection with the right datasource and schema', () => {
    const mockedConnection = { models: {} } as Connection;
    const dataSource = new MongooseDatasource(mockedConnection);

    const carsModel = model('aModel', new Schema({ aField: { type: Number } })) as Model<unknown>;

    const mongooseCollection = new MongooseCollection(dataSource, carsModel, [
      { prefix: null, asFields: [], asModels: [] },
    ]);

    expect(mongooseCollection.dataSource).toEqual(dataSource);
    expect(mongooseCollection.name).toEqual('aModel');
    expect(mongooseCollection.schema.fields).toEqual({
      aField: expect.any(Object),
      _id: expect.any(Object),
    });
  });

  it("should escape collection names even when they don't have a prefix", () => {
    const mockedConnection = { models: {} } as Connection;
    const dataSource = new MongooseDatasource(mockedConnection);

    const systemUsersModel = model(
      'system.users',
      new Schema({ aField: { type: Number } }),
    ) as Model<unknown>;

    const mongooseCollection = new MongooseCollection(dataSource, systemUsersModel, [
      { prefix: null, asFields: [], asModels: [] },
    ]);

    expect(mongooseCollection.name).toEqual('system_users');
  });
});
