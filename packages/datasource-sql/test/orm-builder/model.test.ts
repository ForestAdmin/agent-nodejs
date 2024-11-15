import { Sequelize, UUIDV4 } from 'sequelize';

import { ColumnType, Introspection, Table } from '../../src/introspection/types';
import ModelBuilder from '../../src/orm-builder/model';

const baseColumn = {
  allowNull: false,
  autoIncrement: false,
  primaryKey: false,
  constraints: [],
  defaultValue: null,
  type: { type: 'scalar', subType: 'NUMBER' } as unknown as ColumnType,
  isLiteralDefaultValue: false,
};

const defaultIntrospection: Introspection = {
  tables: [],
  views: [],
  version: 3,
  source: '@forestadmin/datasource-sql',
};

describe('ModelBuilder', () => {
  it('should throw when an invalid type is provided', () => {
    const sequelize = new Sequelize('postgres://');
    const tables: Table[] = [
      {
        name: 'myTable',
        schema: undefined,
        columns: [
          { ...baseColumn, name: 'enumList', type: { type: 'invalid' } as unknown as ColumnType },
        ],
        unique: [],
      },
    ];

    expect(() =>
      ModelBuilder.defineModels(
        sequelize,
        () => {},
        {
          tables,
          views: [],
          version: 3,
          source: '@forestadmin/datasource-sql',
        },
        [],
      ),
    ).toThrow();
  });

  it('should throw when an invalid scalar type is provided', () => {
    const sequelize = new Sequelize('postgres://');
    const tables: Table[] = [
      {
        name: 'myTable',
        schema: undefined,
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

    expect(() =>
      ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []),
    ).toThrow();
  });

  it('should use the default enum type when no enum list name is provided', () => {
    const sequelize = new Sequelize('postgres://');
    const tables: Table[] = [
      {
        name: 'myTable',
        schema: undefined,
        columns: [
          { ...baseColumn, name: 'enumList', type: { type: 'enum', values: ['a', 'b', 'c'] } },
        ],
        unique: [],
      },
    ];

    ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

    expect(sequelize.models.myTable).toBeDefined();
    expect(sequelize.models.myTable.rawAttributes.enumList.type.toString({})).toBe('ENUM');
  });

  it('should use a custom enum type when an enum name is provided', () => {
    const sequelize = new Sequelize('postgres://');
    const tables: Table[] = [
      {
        name: 'myTable',
        schema: undefined,
        columns: [
          {
            name: 'enumList',
            allowNull: false,
            autoIncrement: false,
            primaryKey: false,
            type: { type: 'enum', schema: 'public', name: 'custom_type', values: ['a', 'b', 'c'] },
            constraints: [],
            defaultValue: null,
            isLiteralDefaultValue: false,
          },
        ],
        unique: [],
      },
    ];

    ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

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
          schema: undefined,
          columns: [{ ...baseColumn, name: 'id', primaryKey: false }],
          unique: [],
        },
      ];

      ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

      expect(sequelize.models.myTable).toBeDefined();
      expect(sequelize.models.myTable.rawAttributes.id.primaryKey).toBe(true);
    });

    it('should use the "ID" field, even if not marked as pk in the schema', () => {
      const sequelize = new Sequelize('postgres://');
      const tables: Table[] = [
        {
          name: 'myTable',
          schema: undefined,
          columns: [{ ...baseColumn, name: 'ID', primaryKey: false }],
          unique: [],
        },
      ];

      ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

      expect(sequelize.models.myTable).toBeDefined();
      expect(sequelize.models.myTable.rawAttributes.ID.primaryKey).toBe(true);
    });

    it('should use a unique column is available', () => {
      const sequelize = new Sequelize('postgres://');
      const tables: Table[] = [
        {
          name: 'myTable',
          schema: undefined,
          columns: [
            { ...baseColumn, name: 'uniqueTogether1', primaryKey: false },
            { ...baseColumn, name: 'uniqueTogether2', primaryKey: false },
            { ...baseColumn, name: 'uniqueField', primaryKey: false },
          ],
          unique: [['uniqueTogether1', 'uniqueTogether2'], ['uniqueField']],
        },
      ];

      ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

      expect(sequelize.models.myTable).toBeDefined();
      expect(sequelize.models.myTable.rawAttributes.uniqueField.primaryKey).toBe(true);
    });

    it('should use columns which are unique together otherwise', () => {
      const sequelize = new Sequelize('postgres://');
      const tables: Table[] = [
        {
          name: 'myTable',
          schema: undefined,
          columns: [
            { ...baseColumn, name: 'nonUniqueField', primaryKey: false },
            { ...baseColumn, name: 'uniqueTogether1', primaryKey: false },
            { ...baseColumn, name: 'uniqueTogether2', primaryKey: false },
          ],
          unique: [['uniqueTogether1', 'uniqueTogether2']],
        },
      ];

      ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

      expect(sequelize.models.myTable).toBeDefined();
      expect(sequelize.models.myTable.rawAttributes.uniqueTogether1.primaryKey).toBe(true);
      expect(sequelize.models.myTable.rawAttributes.uniqueTogether2.primaryKey).toBe(true);
    });

    it('should use all columns when we detect this is a many to many relation table', () => {
      const sequelize = new Sequelize('postgres://');
      const tables: Table[] = [
        {
          name: 'myTable',
          schema: undefined,
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

      ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

      expect(sequelize.models.myTable).toBeDefined();
      expect(sequelize.models.myTable.rawAttributes.fk1.primaryKey).toBe(true);
      expect(sequelize.models.myTable.rawAttributes.fk2.primaryKey).toBe(true);
    });

    it('should skip the collection if sequelize throws at our definition', () => {
      const tables: Table[] = [{ name: 'myTable', schema: undefined, columns: [], unique: [] }];
      const logger = jest.fn();
      const sequelize = {
        getDialect: jest.fn().mockReturnValue('postgres'),
        define: jest.fn().mockImplementation(() => {
          throw new Error('Invalid Model.');
        }),
      } as unknown as Sequelize;

      ModelBuilder.defineModels(sequelize, logger, { ...defaultIntrospection, tables }, []);

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Skipping table "myTable" because of error: Invalid Model.',
      );
    });

    describe('when it is a view', () => {
      it('should not log a warning and fallback to the unique id as primary key', () => {
        const sequelize = new Sequelize('postgres://');
        const views: Table[] = [
          {
            name: 'myView',
            schema: undefined,
            columns: [{ ...baseColumn, name: 'id', primaryKey: false }],
            unique: [],
          },
        ];
        const logger = jest.fn();
        ModelBuilder.defineModels(sequelize, logger, { ...defaultIntrospection, views }, []);

        expect(sequelize.models.myView).toBeDefined();
        expect(sequelize.models.myView.rawAttributes.id.primaryKey).toBe(true);
        expect(logger).not.toHaveBeenCalled();
      });

      describe('when there is no unique id', () => {
        it('should take a random column as primary key', () => {
          const sequelize = new Sequelize('postgres://');
          const views: Table[] = [
            {
              name: 'myView',
              schema: undefined,
              columns: [{ ...baseColumn, name: 'notUnique', primaryKey: false }],
              unique: [],
            },
          ];
          const logger = jest.fn();
          ModelBuilder.defineModels(sequelize, logger, { ...defaultIntrospection, views }, []);

          expect(sequelize.models.myView).toBeDefined();
          expect(sequelize.models.myView.rawAttributes.notUnique.primaryKey).toBe(true);
          expect(logger).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('when the default value is a literal', () => {
    it('should cast the default value as a Literal sequelize object', () => {
      const sequelize = new Sequelize('postgres://');
      const column = {
        // a literal default value
        defaultValue: { val: 'gen_random_uuid()' },
        type: { type: 'scalar', subType: 'UUID' },
        autoIncrement: false,
        isLiteralDefaultValue: true,
        name: 'uuid',
        allowNull: false,
        primaryKey: false,
        constraints: [],
      };
      const tables = [
        { columns: [column], name: 'aModel', schema: undefined, unique: [] },
      ] as Table[];

      ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

      expect(sequelize.models.aModel).toBeDefined();
      expect(sequelize.models.aModel.rawAttributes.uuid.defaultValue).toStrictEqual(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Sequelize.literal((column.defaultValue as any).val),
      );
    });

    describe('when there is no defaultValue', () => {
      it('should not cast the default value as a Literal sequelize object', () => {
        const sequelize = new Sequelize('postgres://');
        const column = {
          defaultValue: null,
          type: { type: 'scalar', subType: 'UUID' },
          autoIncrement: false,
          isLiteralDefaultValue: true,
          name: 'uuid',
          allowNull: false,
          primaryKey: false,
          constraints: [],
        };
        const tables = [
          { columns: [column], name: 'aModel', schema: undefined, unique: [] },
        ] as Table[];

        ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

        expect(sequelize.models.aModel).toBeDefined();
        expect(sequelize.models.aModel.rawAttributes.uuid.defaultValue).toBe(null);
      });
    });

    describe('when on MySQL', () => {
      describe('when the default value is UUID', () => {
        it('should use UUIDV4 as the default value', () => {
          const sequelize = new Sequelize('mysql://');
          const column = {
            // a literal default value
            defaultValue: sequelize.literal('uuid()'),
            type: { type: 'scalar', subType: 'STRING' },
            autoIncrement: false,
            isLiteralDefaultValue: true,
            name: 'uuid',
            allowNull: false,
            primaryKey: false,
            constraints: [],
          };

          const tables = [
            { columns: [column], name: 'aModel', schema: undefined, unique: [] },
          ] as Table[];

          ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

          expect(sequelize.models.aModel).toBeDefined();

          expect(sequelize.models.aModel.rawAttributes.uuid.defaultValue).toBeInstanceOf(UUIDV4);
        });
      });
    });
  });

  describe('when there is a schema', () => {
    it('should declare the model in the schema', () => {
      const sequelize = new Sequelize('postgres://');
      const tables: Table[] = [
        {
          name: 'myTable',
          schema: 'mySchema',
          columns: [{ ...baseColumn, name: 'id', primaryKey: false }],
          unique: [],
        },
      ];

      ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

      expect(sequelize.models.myTable.getTableName()).toMatchObject({
        schema: 'mySchema',
        tableName: 'myTable',
      });
    });
  });

  describe('when auto timestamp fields are in snake_case', () => {
    it('should override the corresponding properties', () => {
      const sequelize = new Sequelize('postgres://');
      const columns = [
        {
          name: 'created_at',
          allowNull: false,
          autoIncrement: false,
          primaryKey: false,
          constraints: [],
          defaultValue: null,
          type: { type: 'scalar', subType: 'DATE' } as unknown as ColumnType,
          isLiteralDefaultValue: false,
        },
        {
          name: 'updated_at',
          allowNull: false,
          autoIncrement: false,
          primaryKey: false,
          constraints: [],
          defaultValue: null,
          type: { type: 'scalar', subType: 'DATE' } as unknown as ColumnType,
          isLiteralDefaultValue: false,
        },
        {
          name: 'deleted_at',
          allowNull: false,
          autoIncrement: false,
          primaryKey: false,
          constraints: [],
          defaultValue: null,
          type: { type: 'scalar', subType: 'DATE' } as unknown as ColumnType,
          isLiteralDefaultValue: false,
        },
      ];
      const tables = [{ columns, name: 'aModel', schema: undefined, unique: [] }] as Table[];

      ModelBuilder.defineModels(sequelize, () => {}, { ...defaultIntrospection, tables }, []);

      expect(sequelize.models.aModel).toBeDefined();
      expect(sequelize.models.aModel.rawAttributes.created_at).toBeDefined();
      expect(sequelize.models.aModel.rawAttributes.updated_at).toBeDefined();
      expect(sequelize.models.aModel.rawAttributes.deleted_at).toBeDefined();
      expect(sequelize.models.aModel.options.paranoid).toBeTruthy();
      expect(sequelize.models.aModel.options.timestamps).toBeTruthy();
    });
  });
});
