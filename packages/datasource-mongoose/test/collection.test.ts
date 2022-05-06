import { Connection, Schema, model } from 'mongoose';

import { MongooseDatasource } from '../dist';
import MongooseCollection from '../src/collection';

describe('MongooseCollection', () => {
  it('should build a collection with the right datasource and schema', () => {
    const connection = { models: {} } as Connection;
    const dataSource = new MongooseDatasource(connection);

    const carsModel = model('aModel', new Schema({ aField: { type: Number } }));

    const mongooseCollection = new MongooseCollection(dataSource, carsModel);

    expect(mongooseCollection.dataSource).toEqual(dataSource);
    expect(mongooseCollection.name).toEqual('cars');
    expect(mongooseCollection.schema).toEqual({
      actions: {},
      fields: {
        aField: expect.any(Object),
        _id: expect.any(Object),
      },
      searchable: false,
      segments: [],
    });
  });
});
