import mongoose from 'mongoose';

import { MongooseCollection, MongooseDatasource, createMongooseDataSource } from '../src';

describe('exports', () => {
  it.each([
    ['MongooseCollection', MongooseCollection],
    ['MongooseDatasource', MongooseDatasource],
  ])('class %s should be defined', (message, type) => {
    expect(type).toBeDefined();
  });

  it('createMongooseDataSource should return a datasource factory', async () => {
    const factory = createMongooseDataSource(mongoose.connection, {});
    const dataSource = await factory(() => {});

    expect(factory).toBeInstanceOf(Function);
    expect(dataSource).toBeInstanceOf(MongooseDatasource);
  });
});
