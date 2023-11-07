import { QueryTypes, Sequelize } from 'sequelize';

import Introspector from '../../src/introspection/introspector';
import { SequelizeWithOptions } from '../../src/introspection/type-overrides';

// Mock Sequelize and Logger for testing
const mockSequelize: SequelizeWithOptions = jest.createMockFromModule('sequelize');
const logger = jest.fn();
// Mock the necessary Sequelize methods and their return values
const mockGetQueryInterface = jest.fn();
const mockQueryInterface = {
  showAllTables: jest.fn().mockResolvedValue([{ tableName: 'table1' }]),
  describeTable: jest.fn().mockResolvedValue({
    column1: { type: 'INTEGER', allowNull: false, primaryKey: true },
    column2: { type: 'STRING', allowNull: true, primaryKey: false },
  }),
  showIndex: jest.fn().mockResolvedValue([
    { fields: ['column1'], unique: true },
    { fields: ['column2'], unique: false },
  ]),
  getForeignKeyReferencesForTable: jest.fn().mockResolvedValue([
    {
      columnName: 'column1',
      constraintName: 'fk_column1',
    },
    {
      columnName: 'column2',
      constraintName: 'fk_column2',
    },
  ]),
};
(mockSequelize as Sequelize).getQueryInterface =
  mockGetQueryInterface.mockReturnValue(mockQueryInterface);

describe('Introspector', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTable', () => {
    it('should log errors for missing constraint names', async () => {
      // Mock the Sequelize methods
      const mockDescribeTable = jest.fn().mockResolvedValue({
        column1: { type: 'INTEGER', allowNull: false, primaryKey: true },
      });
      const mockShowIndex = jest.fn().mockResolvedValue([{ fields: ['column1'], unique: true }]);
      const mockQuery = jest.fn().mockResolvedValue([
        {
          constraint_name: 'fk_column1',
          table_name: 'table1',
        },
        {
          constraint_name: 'fk_column2',
          table_name: 'table1',
        },
        {
          constraint_name: 'fk_unknown_column',
          table_name: 'table1',
        },
      ]);
      mockQueryInterface.describeTable = mockDescribeTable;
      mockQueryInterface.showIndex = mockShowIndex;
      mockSequelize.query = mockQuery;
      mockSequelize.getDialect = jest.fn().mockReturnValue('postgres');
      mockSequelize.options = { schema: 'public' };

      await Introspector.introspect(mockSequelize, logger);

      // Assert the Sequelize method calls
      expect(mockDescribeTable).toHaveBeenCalledWith({ tableName: 'table1', schema: 'public' });
      expect(mockShowIndex).toHaveBeenCalledWith({ tableName: 'table1', schema: 'public' });
      expect(mockQuery).toHaveBeenCalledWith(
        `
        SELECT constraint_name, table_name
          FROM information_schema.table_constraints
          WHERE table_name = :tableName 
            AND constraint_type = 'FOREIGN KEY'
            AND (:schema IS NULL OR table_schema = :schema);
        `,
        { replacements: { tableName: 'table1', schema: 'public' }, type: QueryTypes.SELECT },
      );

      // Assert the logger call
      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith(
        'Error',
        // eslint-disable-next-line max-len
        "Failed to load constraints on relation 'fk_unknown_column' on table 'table1'. The relation will be ignored.",
      );
    });
    it('should log errors for missing constraint names for sqlite datasources', async () => {
      // Mock the Sequelize methods
      const mockDescribeTable = jest.fn().mockResolvedValue({
        column1: { type: 'INTEGER', allowNull: false, primaryKey: true },
      });
      const mockShowIndex = jest.fn().mockResolvedValue([{ fields: ['column1'], unique: true }]);
      const mockQuery = jest.fn().mockResolvedValue([
        {
          constraint_name: 'fk_column1',
          table_name: 'table1',
        },
        {
          constraint_name: 'fk_column2',
          table_name: 'table1',
        },
        {
          constraint_name: 'fk_unknown_column',
          table_name: 'table1',
        },
      ]);
      mockQueryInterface.describeTable = mockDescribeTable;
      mockQueryInterface.showIndex = mockShowIndex;
      mockSequelize.query = mockQuery;
      mockSequelize.getDialect = jest.fn().mockReturnValue('sqlite');
      mockSequelize.options = { schema: 'public' };

      await Introspector.introspect(mockSequelize, logger);

      // Assert the Sequelize method calls
      expect(mockDescribeTable).toHaveBeenCalledWith({ tableName: 'table1', schema: 'public' });
      expect(mockShowIndex).toHaveBeenCalledWith({ tableName: 'table1', schema: 'public' });
      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT "from" as constraint_name, :tableName as table_name
        from pragma_foreign_key_list(:tableName);`,
        {
          replacements: { tableName: 'table1' },
          type: QueryTypes.SELECT,
        },
      );

      // Assert the logger call
      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith(
        'Error',
        // eslint-disable-next-line max-len
        "Failed to load constraints on relation 'fk_unknown_column' on table 'table1'. The relation will be ignored.",
      );
    });
    it('should skip mssql tables with dots in their names and log a warning', async () => {
      mockQueryInterface.showAllTables = jest
        .fn()
        .mockResolvedValue([{ tableName: 'table.1' }, { tableName: 'table2' }]);

      mockSequelize.query = jest.fn().mockResolvedValue([]);
      mockSequelize.getDialect = jest.fn().mockReturnValue('mssql');

      const result = await Introspector.introspect(mockSequelize, logger);
      expect(result).toStrictEqual([expect.objectContaining({ name: 'table2' })]);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        "Skipping table 'table.1', MSSQL tables with dots in their names are not supported",
      );
    });
  });
});
