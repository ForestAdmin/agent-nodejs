import { Sequelize } from 'sequelize';

import {
  SequelizeCollection,
  SequelizeDataSource,
  TypeConverter,
  createSequelizeDataSource,
} from '../src';

jest.mock('../src/datasource', () => {
  return { __esModule: true, default: jest.fn() };
});

describe('exports', () => {
  describe.each([
    ['SequelizeCollection', SequelizeCollection],
    ['SequelizeDataSource', SequelizeDataSource],
    ['TypeConverter', TypeConverter],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });

  describe('createSequelizeDataSource', () => {
    it('instantiate a sequelize datasource with the right given options', () => {
      const connection = {} as unknown as Sequelize;
      const factory = createSequelizeDataSource(connection, { castUuidToString: true });
      factory(() => ({}));
      expect(SequelizeDataSource).toHaveBeenCalledWith(connection, expect.any(Function), {
        castUuidToString: true,
      });
    });
  });
});
