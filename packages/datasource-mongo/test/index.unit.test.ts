import type { IntrospectorParams } from '../src';
import type { Introspection } from '../src/introspection/types';
import type { Connection } from 'mongoose';

import { buildMongooseInstance, introspect } from '../src';
import createConnection from '../src/connection/create-connection';
import Introspector from '../src/introspection/introspector';
import OdmBuilder from '../src/odm-builder';

jest.mock('@forestadmin/datasource-mongoose');
jest.mock('../src/introspection/introspector');
jest.mock('../src/odm-builder');
jest.mock('../src/connection/create-connection');

describe('DatasourceMongo', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  function setupConnectionMock() {
    const db = Symbol('db');
    const connection = {
      getClient: jest.fn().mockReturnValue({
        db: jest.fn().mockReturnValue(db),
      }),
      close: jest.fn(),
    };
    jest.mocked(createConnection).mockResolvedValue(connection as unknown as Connection);

    return { db, connection };
  }

  describe('introspect', () => {
    function setupSuccessMock() {
      const { db, connection } = setupConnectionMock();

      const introspection = Symbol('introspection') as unknown as Introspection;
      jest.mocked(Introspector.introspect).mockResolvedValue(introspection);

      return { db, connection, introspection };
    }

    describe('in case of success', () => {
      it('should return the introspection from a mongoose connection', async () => {
        const { db, introspection } = setupSuccessMock();

        const params: IntrospectorParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
          },
          introspection: {
            collectionSampleSize: 100,
          },
        };

        const result = await introspect(params);

        expect(result).toBe(introspection);
        expect(createConnection).toHaveBeenCalledWith(params);
        expect(Introspector.introspect).toHaveBeenCalledWith(db, params.introspection);
      });

      it('should close the connection after the introspection', async () => {
        const { connection } = setupSuccessMock();

        const params: IntrospectorParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
          },
          introspection: {
            collectionSampleSize: 100,
          },
        };

        await introspect(params);

        expect(connection.close).toHaveBeenCalledWith(true);
      });
    });

    describe('in case of error', () => {
      it('should throw and close the connection after the introspection', async () => {
        const { connection } = setupSuccessMock();
        const error = new Error('Connection error');
        jest.mocked(Introspector.introspect).mockRejectedValue(error);

        const params: IntrospectorParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
          },
          introspection: {
            collectionSampleSize: 100,
          },
        };

        await expect(introspect(params)).rejects.toThrow('Connection error');

        expect(connection.close).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('buildMongooseInstance', () => {
    it('should create and return the connection', async () => {
      const { connection } = setupConnectionMock();

      const introspection: Introspection = {
        version: 1,
        source: '@forestadmin/datasource-mongo',
        models: [],
      };

      const params: IntrospectorParams = {
        uri: 'mongodb://localhost:27017',
        connection: {
          dbName: 'test',
        },
        introspection: {
          collectionSampleSize: 100,
        },
      };

      const result = await buildMongooseInstance(params, introspection);

      expect(result).toBe(connection);
      expect(createConnection).toHaveBeenCalledWith(params);
    });

    it('should not close the connection if everything went well', async () => {
      const { connection } = setupConnectionMock();

      const introspection: Introspection = {
        version: 1,
        source: '@forestadmin/datasource-mongo',
        models: [],
      };

      const params: IntrospectorParams = {
        uri: 'mongodb://localhost:27017',
        connection: {
          dbName: 'test',
        },
        introspection: {
          collectionSampleSize: 100,
        },
      };

      await buildMongooseInstance(params, introspection);

      expect(connection.close).not.toHaveBeenCalled();
    });

    describe('when the introspection is provided', () => {
      it('should not call the introspector', async () => {
        setupConnectionMock();

        const introspection: Introspection = {
          version: 1,
          source: '@forestadmin/datasource-mongo',
          models: [],
        };

        const params: IntrospectorParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
          },
          introspection: {
            collectionSampleSize: 100,
          },
        };

        await buildMongooseInstance(params, introspection);

        expect(Introspector.introspect).not.toHaveBeenCalled();
      });

      it('should define the models on the connection, from the introspection', async () => {
        const { connection } = setupConnectionMock();

        const introspection: Introspection = {
          version: 1,
          source: '@forestadmin/datasource-mongo',
          models: [
            {
              name: 'users',
              analysis: {
                nullable: true,
                type: 'string',
              },
            },
          ],
        };

        const params: IntrospectorParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
          },
          introspection: {
            collectionSampleSize: 100,
          },
        };

        await buildMongooseInstance(params, introspection);

        expect(createConnection).toHaveBeenCalledWith(params);
        expect(OdmBuilder.defineModels).toHaveBeenCalledWith(connection, introspection.models);
      });

      it('should assert the introspection is in the latest format', async () => {
        setupConnectionMock();

        const introspection: Introspection = {
          version: 2,
          source: '@forestadmin/datasource-mongo',
          models: [],
        };

        const params: IntrospectorParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
          },
          introspection: {
            collectionSampleSize: 100,
          },
        };

        await buildMongooseInstance(params, introspection);

        expect(Introspector.assertGivenIntrospectionInLatestFormat).toHaveBeenCalledWith(
          introspection,
        );
      });
    });

    describe('when the introspection is not provided', () => {
      it('should call the introspector and use its result to define models', async () => {
        const { connection, db } = setupConnectionMock();

        const introspection: Introspection = {
          version: 1,
          source: '@forestadmin/datasource-mongo',
          models: [
            {
              name: 'users',
              analysis: {
                nullable: true,
                type: 'string',
              },
            },
          ],
        };

        const params: IntrospectorParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
          },
          introspection: {
            collectionSampleSize: 100,
          },
        };

        jest.mocked(Introspector.introspect).mockResolvedValue(introspection);

        await buildMongooseInstance(params);

        expect(createConnection).toHaveBeenCalledWith(params);
        expect(Introspector.introspect).toHaveBeenCalledWith(db, params.introspection);
        expect(OdmBuilder.defineModels).toHaveBeenCalledWith(connection, introspection.models);
      });
    });

    describe('in case of an error', () => {
      it('should close the connection if the assertion fails', async () => {
        const { connection } = setupConnectionMock();

        const introspection: Introspection = {
          version: 2,
          source: '@forestadmin/datasource-mongo',
          models: [],
        };

        const params: IntrospectorParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
          },
          introspection: {
            collectionSampleSize: 100,
          },
        };

        const error = new Error('Introspection error');

        jest.mocked(Introspector.assertGivenIntrospectionInLatestFormat).mockImplementation(() => {
          throw error;
        });

        await expect(buildMongooseInstance(params, introspection)).rejects.toThrow(error);

        expect(connection.close).toHaveBeenCalledWith(true);
      });

      it('should close the connection if the introspection fails', async () => {
        const { connection } = setupConnectionMock();

        const params: IntrospectorParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
          },
          introspection: {
            collectionSampleSize: 100,
          },
        };

        const error = new Error('Introspection error');

        jest.mocked(Introspector.introspect).mockRejectedValue(error);

        await expect(buildMongooseInstance(params)).rejects.toThrow(error);

        expect(connection.close).toHaveBeenCalledWith(true);
      });

      it('should close the connection if the model definition fails', async () => {
        const { connection } = setupConnectionMock();

        const introspection: Introspection = {
          version: 1,
          source: '@forestadmin/datasource-mongo',
          models: [
            {
              name: 'users',
              analysis: {
                nullable: true,
                type: 'string',
              },
            },
          ],
        };

        const params: IntrospectorParams = {
          uri: 'mongodb://localhost:27017',
          connection: {
            dbName: 'test',
          },
          introspection: {
            collectionSampleSize: 100,
          },
        };

        const error = new Error('Model definition error');

        jest.mocked(OdmBuilder.defineModels).mockImplementation(() => {
          throw error;
        });

        await expect(buildMongooseInstance(params, introspection)).rejects.toThrow(error);

        expect(connection.close).toHaveBeenCalledWith(true);
      });
    });
  });
});
