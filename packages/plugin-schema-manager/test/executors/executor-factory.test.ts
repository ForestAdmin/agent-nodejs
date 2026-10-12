import { ExecutorFactory } from '../../src/executors/executor-factory';
import { SequelizeSchemaExecutor } from '../../src/executors/sequelize-executor';
import { MongoSchemaExecutor } from '../../src/executors/mongo-executor';
import { UnsupportedSchemaExecutor } from '../../src/executors/unsupported-executor';

describe('ExecutorFactory', () => {
  describe('create', () => {
    it('should create SequelizeExecutor for Sequelize instance', () => {
      const mockSequelize = {
        getQueryInterface: jest.fn(),
        getDialect: jest.fn(() => 'postgres'),
      };

      const executor = ExecutorFactory.create({ sequelize: mockSequelize });

      expect(executor).toBeInstanceOf(SequelizeSchemaExecutor);
      expect(executor.dialect).toBe('postgres');
    });

    it('should create SequelizeExecutor for model with sequelize', () => {
      const mockSequelize = {
        getQueryInterface: jest.fn(),
        getDialect: jest.fn(() => 'mysql'),
      };

      const mockModel = {
        sequelize: mockSequelize,
      };

      const executor = ExecutorFactory.create({ model: mockModel });

      expect(executor).toBeInstanceOf(SequelizeSchemaExecutor);
    });

    it('should create MongoExecutor for MongoDB db', () => {
      const mockDb = {
        createCollection: jest.fn(),
        listCollections: jest.fn(),
      };

      const executor = ExecutorFactory.create({ db: mockDb });

      expect(executor).toBeInstanceOf(MongoSchemaExecutor);
    });

    it('should create MongoExecutor for connection with db', () => {
      const mockDb = {
        createCollection: jest.fn(),
        listCollections: jest.fn(),
      };

      const executor = ExecutorFactory.create({ connection: { db: mockDb } });

      expect(executor).toBeInstanceOf(MongoSchemaExecutor);
    });

    it('should create UnsupportedExecutor for null', () => {
      const executor = ExecutorFactory.create(null);

      expect(executor).toBeInstanceOf(UnsupportedSchemaExecutor);
    });

    it('should create UnsupportedExecutor for undefined', () => {
      const executor = ExecutorFactory.create(undefined);

      expect(executor).toBeInstanceOf(UnsupportedSchemaExecutor);
    });

    it('should create UnsupportedExecutor for unknown driver', () => {
      const executor = ExecutorFactory.create({ unknown: 'driver' });

      expect(executor).toBeInstanceOf(UnsupportedSchemaExecutor);
    });
  });

  describe('isSupported', () => {
    it('should return true for Sequelize', () => {
      const mockSequelize = {
        getQueryInterface: jest.fn(),
        getDialect: jest.fn(() => 'postgres'),
      };

      const isSupported = ExecutorFactory.isSupported({ sequelize: mockSequelize });

      expect(isSupported).toBe(true);
    });

    it('should return true for MongoDB', () => {
      const mockDb = {
        createCollection: jest.fn(),
        listCollections: jest.fn(),
      };

      const isSupported = ExecutorFactory.isSupported({ db: mockDb });

      expect(isSupported).toBe(true);
    });

    it('should return false for unsupported drivers', () => {
      const isSupported = ExecutorFactory.isSupported({ unknown: 'driver' });

      expect(isSupported).toBe(false);
    });

    it('should return false for null', () => {
      const isSupported = ExecutorFactory.isSupported(null);

      expect(isSupported).toBe(false);
    });
  });
});
