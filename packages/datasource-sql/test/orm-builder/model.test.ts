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
    it('should force the primary key to true when the column is an ID', () => {
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

    describe('when there is an unique field and no ID', () => {
      it('should force at the first one the primary key to true when the field is unique', () => {
        const sequelize = new Sequelize('postgres://');
        const tables: Table[] = [
          {
            name: 'myTable',
            columns: [{ ...baseColumn, name: 'uniqueField', primaryKey: false }],
            unique: [['uniqueField']],
          },
        ];

        ModelBuilder.defineModels(sequelize, () => {}, tables);

        expect(sequelize.models.myTable).toBeDefined();
        expect(sequelize.models.myTable.rawAttributes.uniqueField.primaryKey).toBe(true);
      });
    });

    describe('when there are two unique field and no ID', () => {
      it('should force at the first one the primary key to true when the field is unique', () => {
        const sequelize = new Sequelize('postgres://');
        const tables: Table[] = [
          {
            name: 'myTable',
            columns: [
              { ...baseColumn, name: 'fk1', primaryKey: false },
              { ...baseColumn, name: 'fk2', primaryKey: false },
            ],
            unique: [['fk1', 'fk2']],
          },
        ];

        ModelBuilder.defineModels(sequelize, () => {}, tables);

        expect(sequelize.models.myTable).toBeDefined();
        expect(sequelize.models.myTable.rawAttributes.fk1.primaryKey).toBe(true);
        expect(sequelize.models.myTable.rawAttributes.fk2.primaryKey).toBe(true);
      });
    });
  });
});
