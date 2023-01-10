/* eslint-disable no-underscore-dangle */
/* eslint-disable jest/no-disabled-tests */

import { Connection, Schema, model } from 'mongoose';

import MongooseCollection from '../src/collection';
import MongooseDatasource from '../src/datasource';

describe('MongooseCollection', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('should build a collection with the right datasource and schema', () => {
    const mockedConnection = { models: {} } as Connection;
    const dataSource = new MongooseDatasource(mockedConnection);

    const carsModel = model('aModel', new Schema({ aField: { type: Number } }));

    const mongooseCollection = new MongooseCollection(dataSource, carsModel);

    expect(mongooseCollection.dataSource).toEqual(dataSource);
    expect(mongooseCollection.name).toEqual('aModel');
    expect(mongooseCollection.schema).toEqual({
      actions: {},
      charts: [],
      countable: true,
      fields: {
        aField: expect.any(Object),
        _id: expect.any(Object),
      },
      searchable: false,
      segments: [],
    });
  });
});
