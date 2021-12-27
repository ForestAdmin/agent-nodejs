import { Connection, Model } from 'mongoose';
import { RecordData } from '@forestadmin/datasource-toolkit';

import MongooseDatasource from '../src/datasource';
import MongooseCollection from '../src/collection';

describe('MongooseDatasource', () => {
  const setupConnection = () => {
    const connection = { models: {} } as Connection;
    connection.models.cars = {
      schema: {
        paths: {},
      },
    } as Model<RecordData>;

    return connection;
  };

  describe('when connection does not have model', () => {
    it('should not throw', () => {
      const connection = { models: {} } as Connection;

      expect(() => new MongooseDatasource(connection)).not.toThrow();
    });
  });

  describe('when connection have models', () => {
    it('should build collections from connection', () => {
      const connection = setupConnection();

      const mongooseDatasource = new MongooseDatasource(connection);

      expect(mongooseDatasource.collections).toHaveLength(1);
      expect(mongooseDatasource.collections[0]).toBeInstanceOf(MongooseCollection);
    });
  });
});
