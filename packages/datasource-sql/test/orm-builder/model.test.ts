import { Sequelize } from 'sequelize';

import { ColumnType, Table } from '../../src/introspection/types';
import ModelBuilder from '../../src/orm-builder/model';

const baseColumn = {
  allowNull: false,
  autoIncrement: false,
  primaryKey: false,
  constraints: [],
  defaultValue: null,
  type: { type: 'scalar', subType: 'NUMBER' } as unknown as ColumnType,
};

describe('ModelBuilder', () => {
  it('should throw when an invalid type is provided', () => {
    const sequelize = new Sequelize('postgres://');
    const tables: Table[] = [
      {
        name: 'myTable',
        columns: [
          { ...baseColumn, name: 'enumList', type: { type: 'invalid' } as unknown as ColumnType },
        ],
        unique: [],
      },
    ];

    expect(() => ModelBuilder.defineModels(sequelize, () => {}, tables)).toThrow();
  });

  it('should throw when an invalid scalar type is provided', () => {
    const sequelize = new Sequelize('postgres://');
    const tables: Table[] = [
      {
        name: 'myTable',
        columns: [
          {
            ...baseColumn,
            name: 'enumList',
            type: { type: 'scalar', subType: 'invalid' } as unknown as ColumnType,
          },
        ],
        unique: [],
      },
    ];

    expect(() => ModelBuilder.defineModels(sequelize, () => {}, tables)).toThrow();
  });

  it('should use the default enum type when no enum list name is provided', () => {
    const sequelize = new Sequelize('postgres://');
    const tables: Table[] = [
      {
        name: 'myTable',
        columns: [
          { ...baseColumn, name: 'enumList', type: { type: 'enum', values: ['a', 'b', 'c'] } },
        ],
        unique: [],
      },
    ];

    ModelBuilder.defineModels(sequelize, () => {}, tables);

    expect(sequelize.models.myTable).toBeDefined();
    expect(sequelize.models.myTable.rawAttributes.enumList.type.toString({})).toBe('ENUM');
  });

  it('should use a custom enum type when an enum name is provided', () => {
    const sequelize = new Sequelize('postgres://');
    const tables: Table[] = [
      {
        name: 'myTable',
        columns: [
          {
            name: 'enumList',
            allowNull: false,
            autoIncrement: false,
            primaryKey: false,
            type: { type: 'enum', schema: 'public', name: 'custom_type', values: ['a', 'b', 'c'] },
            constraints: [],
            defaultValue: null,
          },
        ],
        unique: [],
      },
    ];

    ModelBuilder.defineModels(sequelize, () => {}, tables);

    expect(sequelize.models.myTable).toBeDefined();
    expect(sequelize.models.myTable.rawAttributes.enumList.type.toString({})).toBe(
      '"public"."custom_type"',
    );
  });

  describe('when there is no primary key', () => {
    it('should use the "id" field, even if not marked as pk in the schema', () => {
      const sequelize = new Sequelize('postgres://');
      const tables: Table[] = [
        {
          name: 'myTable',
          columns: [{ ...baseColumn, name: 'id', primaryKey: false }],
          unique: [],
        },
      ];

      ModelBuilder.defineModels(sequelize, () => {}, tables);

      expect(sequelize.models.myTable).toBeDefined();
      expect(sequelize.models.myTable.rawAttributes.id.primaryKey).toBe(true);
    });

    it('should use a unique column is available', () => {
      const sequelize = new Sequelize('postgres://');
      const tables: Table[] = [
        {
          name: 'myTable',
          columns: [
            { ...baseColumn, name: 'uniqueTogether1', primaryKey: false },
            { ...baseColumn, name: 'uniqueTogether2', primaryKey: false },
            { ...baseColumn, name: 'uniqueField', primaryKey: false },
          ],
          unique: [['uniqueTogether1', 'uniqueTogether2'], ['uniqueField']],
        },
      ];

      ModelBuilder.defineModels(sequelize, () => {}, tables);

      expect(sequelize.models.myTable).toBeDefined();
      expect(sequelize.models.myTable.rawAttributes.uniqueField.primaryKey).toBe(true);
    });

    it('should use columns which are unique together otherwise', () => {
      const sequelize = new Sequelize('postgres://');
      const tables: Table[] = [
        {
          name: 'myTable',
          columns: [
            { ...baseColumn, name: 'nonUniqueField', primaryKey: false },
            { ...baseColumn, name: 'uniqueTogether1', primaryKey: false },
            { ...baseColumn, name: 'uniqueTogether2', primaryKey: false },
          ],
          unique: [['uniqueTogether1', 'uniqueTogether2']],
        },
      ];

      ModelBuilder.defineModels(sequelize, () => {}, tables);

      expect(sequelize.models.myTable).toBeDefined();
      expect(sequelize.models.myTable.rawAttributes.uniqueTogether1.primaryKey).toBe(true);
      expect(sequelize.models.myTable.rawAttributes.uniqueTogether2.primaryKey).toBe(true);
    });

    it('should use all columns when we detect this is a many to many relation table', () => {
      const sequelize = new Sequelize('postgres://');
      const tables: Table[] = [
        {
          name: 'myTable',
          columns: [
            {
              ...baseColumn,
              name: 'fk1',
              primaryKey: false,
              constraints: [{ column: 'a', table: 'a' }],
            },
            {
              ...baseColumn,
              name: 'fk2',
              primaryKey: false,
              constraints: [{ column: 'a', table: 'a' }],
            },
          ],
          unique: [],
        },
      ];

      ModelBuilder.defineModels(sequelize, () => {}, tables);

      expect(sequelize.models.myTable).toBeDefined();
      expect(sequelize.models.myTable.rawAttributes.fk1.primaryKey).toBe(true);
      expect(sequelize.models.myTable.rawAttributes.fk2.primaryKey).toBe(true);
    });

    it('should skip the collection if sequelize throws at our definition', () => {
      const tables: Table[] = [{ name: 'myTable', columns: [], unique: [] }];
      const logger = jest.fn();
      const sequelize = {
        getDialect: jest.fn().mockReturnValue('postgres'),
        define: jest.fn().mockImplementation(() => {
          throw new Error('Invalid Model.');
        }),
      } as unknown as Sequelize;

      ModelBuilder.defineModels(sequelize, logger, tables);

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Skipping table "myTable" because of error: Invalid Model.',
      );
    });
  });
});
