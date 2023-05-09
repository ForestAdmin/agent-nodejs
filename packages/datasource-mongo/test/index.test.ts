/* eslint-disable import/first */

// Mock mongoose
const db = Symbol('db');
const connectionDb = { db: jest.fn().mockReturnValue(db) };
const connection = {
  getClient: jest.fn().mockReturnValue(connectionDb),
  close: jest.fn(),
};
const createConnection = jest.fn().mockReturnValue(connection);

jest.mock('mongoose', () => ({ version: '7.0.0', createConnection }));

// Mock introspection module
const introspection = {};
const introspectMethod = jest.fn().mockResolvedValue(introspection);
jest.mock('../src/introspection', () => ({ introspect: introspectMethod }));

// Mock odm-builder module
const defineModelsMethod = jest.fn();
jest.mock('../src/odm-builder', () => ({ defineModels: defineModelsMethod }));

// Mock fs module
const readFile = jest.fn().mockResolvedValue(null);
const writeFile = jest.fn().mockResolvedValue(null);
jest.mock('fs/promises', () => ({ readFile, writeFile }));

// Mock @forestadmin/datasource-mongoose
const mongooseDs = Symbol('mongooseDs');
const createMongooseDataSourceMethod = jest.fn().mockReturnValue(mongooseDs);
jest.mock('@forestadmin/datasource-mongoose', () => ({
  MongooseDatasource: createMongooseDataSourceMethod,
}));

import { createMongoDataSource, introspect } from '../src/index';

describe('Index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('introspect', () => {
    it('shoud work', async () => {
      const result = await introspect({
        uri: 'mongodb://localhost/test',
        connectOptions: { ca: 'abc' },
        introspectionOptions: {
          collectionSampleSize: 10,
          maxPropertiesPerObject: 10,
          referenceSampleSize: 10,
        },
      });

      expect(createConnection).toHaveBeenCalledWith('mongodb://localhost/test', { ca: 'abc' });
      expect(introspectMethod).toHaveBeenCalledWith(db, {
        collectionSampleSize: 10,
        maxPropertiesPerObject: 10,
        referenceSampleSize: 10,
      });
      expect(connection.close).toHaveBeenCalledWith(true);
      expect(result).toBe(introspection);
    });
  });

  describe('createMongoDataSource', () => {
    it('should throw an error when no introspection or introspectionPath is provided', () => {
      expect(() => createMongoDataSource({ uri: 'mongodb://localhost/test' })).toThrow(
        'You must provide either introspection or introspectionPath',
      );
    });

    it('should throw an error when both introspection and introspectionPath are provided', () => {
      expect(() =>
        createMongoDataSource({
          uri: 'mongodb://localhost/test',
          introspection: [],
          introspectionPath: '/tmp/introspection.json',
        }),
      ).toThrow('You cannot provide both introspection and introspectionPath');
    });

    it('should work when introspection is not on disk', async () => {
      readFile.mockRejectedValueOnce(new Error('File not found'));

      const factory = createMongoDataSource({
        uri: 'mongodb://localhost/test',
        connectOptions: { ca: 'abc' },
        introspectionPath: '/tmp/introspection.json',
        introspectionOptions: {
          collectionSampleSize: 10,
          maxPropertiesPerObject: 10,
          referenceSampleSize: 10,
        },
      });

      await factory(() => {});

      expect(createConnection).toHaveBeenCalledWith('mongodb://localhost/test', { ca: 'abc' });
      expect(introspectMethod).toHaveBeenCalledWith(db, {
        collectionSampleSize: 10,
        maxPropertiesPerObject: 10,
        referenceSampleSize: 10,
      });
      expect(connection.close).not.toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalledWith('/tmp/introspection.json', '{}');
      expect(readFile).toHaveBeenCalledWith('/tmp/introspection.json', 'utf-8');
      expect(defineModelsMethod).toHaveBeenCalledWith(connection, introspection);
    });

    it('should work when introspection is already on disk', async () => {
      readFile.mockResolvedValueOnce('{}');

      const factory = createMongoDataSource({
        uri: 'mongodb://localhost/test',
        connectOptions: { ca: 'abc' },
        introspectionPath: '/tmp/introspection.json',
        introspectionOptions: {
          collectionSampleSize: 10,
          maxPropertiesPerObject: 10,
          referenceSampleSize: 10,
        },
      });

      await factory(() => {});

      expect(createConnection).toHaveBeenCalledWith('mongodb://localhost/test', { ca: 'abc' });
      expect(introspectMethod).not.toHaveBeenCalled();
      expect(connection.close).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
      expect(readFile).toHaveBeenCalledWith('/tmp/introspection.json', 'utf-8');
      expect(defineModelsMethod).toHaveBeenCalledWith(connection, introspection);
    });
  });
});
