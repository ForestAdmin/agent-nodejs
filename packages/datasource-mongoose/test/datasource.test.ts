import { Connection, Model, Schema } from 'mongoose';
import { RecordData } from '@forestadmin/datasource-toolkit';

import MongooseCollection from '../src/collection';
import MongooseDatasource from '../src/datasource';

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

    describe('when models have relations', () => {
      it('should add relation to the schema', () => {
        const connection = { models: {} } as Connection;
        connection.models.cars = {
          modelName: 'cars',
          schema: {
            paths: new Schema({
              aManyToOneRelation: { type: Schema.Types.ObjectId, ref: 'companies' },
            }).paths,
          },
        } as Model<RecordData>;

        connection.models.owner = {
          modelName: 'owner',
          schema: {
            paths: new Schema().paths,
          },
        } as Model<RecordData>;

        const mongooseDatasource = new MongooseDatasource(connection);

        expect(mongooseDatasource.collections[1].schema.fields).toHaveProperty('cars__oneToMany');
      });
    });
  });
});
