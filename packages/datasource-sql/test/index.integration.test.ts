import { buildDisconnectedSequelizeInstance } from '../src';
import { Introspection3 } from '../src/introspection/types';

describe('index', () => {
  describe('sqlite3 dependency', () => {
    it('should not be able to load the SQLITE3 module', () => {
      // We want to make sure that the sqlite3 module is not installed
      // even as a dev dependency for another package.
      // eslint-disable-next-line global-require, import/no-extraneous-dependencies
      expect(() => require('sqlite3')).toThrow();
    });
  });

  describe('buildDisconnectedSequelizeInstance', () => {
    it('should build a sequelize instance', async () => {
      const introspection: Introspection3 = {
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'id',
                type: { type: 'scalar', subType: 'INTEGER' },
                defaultValue: null,
                isLiteralDefaultValue: false,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                constraints: [],
              },
            ],
            unique: [],
            schema: 'public',
          },
        ],
        version: 3,
        views: [],
        source: '@forestadmin/datasource-sql',
      };
      const logger = jest.fn();
      const sequelize = await buildDisconnectedSequelizeInstance(introspection, logger);
      expect(sequelize).toBeDefined();
    });
  });
});
