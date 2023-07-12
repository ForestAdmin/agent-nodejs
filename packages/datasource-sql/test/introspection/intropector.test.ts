import { QueryTypes, Sequelize } from 'sequelize';

import Introspector from '../../src/introspection/introspector';

// Mock Sequelize and Logger for testing
const mockSequelize: Sequelize = jest.createMockFromModule('sequelize');
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
          table_name: 'table1',
          constraint_name: 'fk_column1',
        },
        {
          table_name: 'table1',
          constraint_name: 'fk_column2',
        },
        {
          table_name: 'table1',
          constraint_name: 'fk_unknown_column',
        },
      ]);
      mockQueryInterface.describeTable = mockDescribeTable;
      mockQueryInterface.showIndex = mockShowIndex;
      mockSequelize.query = mockQuery;
      mockSequelize.getDialect = jest.fn().mockResolvedValue('postgres');

      await Introspector.introspect(mockSequelize, logger);

      // Assert the Sequelize method calls
      expect(mockDescribeTable).toHaveBeenCalledWith('table1');
      expect(mockShowIndex).toHaveBeenCalledWith('table1');
      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT constraint_name, table_name from information_schema.table_constraints 
          where table_name = :tableName and constraint_type = 'FOREIGN KEY';`,
        { replacements: { tableName: 'table1' }, type: QueryTypes.SELECT },
      );

      // Assert the logger call
      expect(logger).toHaveBeenCalledWith(
        'Error',
        // eslint-disable-next-line max-len
        "Failed to load constraints on relation 'fk_unknown_column' on table 'table1'. The relation will be ignored.",
      );
    });
  });
});
