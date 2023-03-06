import { Sequelize } from 'sequelize';

import { ColumnType, Table } from '../../src/introspection/types';
import ModelBuilder from '../../src/orm-builder/model';

const baseColumn = {
  allowNull: false,
  autoIncrement: false,
  primaryKey: false,
  constraints: [],
  defaultValue: null,
  unique: false,
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
            unique: false,
          },
        ],
      },
    ];

    ModelBuilder.defineModels(sequelize, () => {}, tables);

    expect(sequelize.models.myTable).toBeDefined();
    expect(sequelize.models.myTable.rawAttributes.enumList.type.toString({})).toBe(
      '"public"."custom_type"',
    );
  });
  describe('when there is no primary key', () => {
    it('should force the primary key to true when the column is an ID', () => {
      const sequelize = new Sequelize('postgres://');
      const tables: Table[] = [
        {
          name: 'myTable',
          columns: [{ ...baseColumn, name: 'id', primaryKey: false }],
        },
      ];

      ModelBuilder.defineModels(sequelize, () => {}, tables);

      expect(sequelize.models.myTable).toBeDefined();
      expect(sequelize.models.myTable.rawAttributes.id.primaryKey).toBe(true);
    });

    describe('when there is an unique field and no ID', () => {
      it('should force at the first one the primary key to true when the field is unique', () => {
        const sequelize = new Sequelize('postgres://');
        const tables: Table[] = [
          {
            name: 'myTable',
            columns: [{ ...baseColumn, name: 'uniqueField', primaryKey: false, unique: true }],
          },
        ];

        ModelBuilder.defineModels(sequelize, () => {}, tables);

        expect(sequelize.models.myTable).toBeDefined();
        expect(sequelize.models.myTable.rawAttributes.uniqueField.primaryKey).toBe(true);
      });
    });
  });
});
