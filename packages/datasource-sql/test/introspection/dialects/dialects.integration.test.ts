import { DataTypes, Sequelize } from 'sequelize';

import MsSQLDialect from '../../../src/introspection/dialects/mssql-dialect';
import PostgreSQLDialect from '../../../src/introspection/dialects/postgresql-dialect';
import {
  ConnectionDetails,
  MSSQL_DETAILS,
  POSTGRESQL_DETAILS,
} from '../../_helpers/connection-details';

const DB_NAME = 'dialect-test-db';

async function setupSchema(connectionDetails: ConnectionDetails, schema: string | undefined) {
  if (!schema || schema === 'public') return;

  const sequelize = new Sequelize({
    ...connectionDetails.options(DB_NAME),
    logging: false,
  });

  try {
    await sequelize.createSchema(schema, {
      logging: false,
    });
  } finally {
    await sequelize.close();
  }
}

async function setupDB(connectionDetails: ConnectionDetails, dbName: string) {
  const sequelize = new Sequelize({ ...connectionDetails.options(), logging: false });

  await sequelize.query(`DROP DATABASE IF EXISTS "${dbName}"`, {
    logging: false,
  });
  await sequelize.getQueryInterface().createDatabase(dbName);
  await sequelize.close();
}

describe.each([
  {
    connectionDetails: POSTGRESQL_DETAILS,
    dialectFactory: () => new PostgreSQLDialect(),
    dialectSql: {
      autoIncrement: (schema: string | undefined, tableName: string, id = 'id') => ({
        defaultValue: `nextval('${
          schema && schema !== POSTGRESQL_DETAILS.defaultSchema ? `${schema}.` : ''
        }${tableName}_${id}_seq'::regclass)`,
        isLiteralDefaultValue: true,
      }),
      now: 'now()',
      integer: 'INTEGER',
    },
  },
  {
    connectionDetails: MSSQL_DETAILS,
    dialectFactory: () => new MsSQLDialect(),
    dialectSql: {
      now: 'getdate()',
      autoIncrement: (schema: string | undefined, tableName: string, idName?: string) => ({
        defaultValue: null,
        isLiteralDefaultValue: false,
      }),
      integer: 'INT',
    },
  },
])('$name dialect', ({ connectionDetails, dialectFactory, dialectSql }) => {
  beforeEach(async () => {
    await setupDB(connectionDetails, DB_NAME);
  });

  describe('describeTables', () => {
    describe('with one table', () => {
      describe('with specific schemas', () => {
        describe.each([connectionDetails.defaultSchema, 'other', undefined])(
          'with schema %s',
          schema => {
            let connection: Sequelize;

            beforeEach(async () => {
              await setupSchema(connectionDetails, schema);

              connection = new Sequelize({
                ...connectionDetails.options(DB_NAME),
                logging: false,
                schema,
              });
            });

            afterEach(async () => {
              await connection.close();
            });

            it('returns the table', async () => {
              const dialect = dialectFactory();

              connection.define(
                'elements',
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                },
                { schema, paranoid: false, createdAt: false, updatedAt: false },
              );
              await connection.sync({ force: true });

              const tableNames = [{ schema, tableName: 'elements' }];
              const tableColumns = await dialect.listColumns(tableNames, connection);
              expect(tableColumns).toEqual([
                [
                  expect.objectContaining({
                    allowNull: false,
                    autoIncrement: true,
                    comment: null,
                    name: 'id',
                    primaryKey: true,
                    type: dialectSql.integer,
                    ...dialectSql.autoIncrement(schema, 'elements'),
                  }),
                ],
              ]);
            });
          },
        );
      });

      describe(`on ${connectionDetails.defaultSchema}`, () => {
        let connection: Sequelize;

        beforeEach(async () => {
          await setupSchema(connectionDetails, 'other');

          connection = new Sequelize({
            ...connectionDetails.options(DB_NAME),
            logging: false,
          });
        });

        afterEach(async () => {
          await connection.close();
        });

        it('should return columns in the order they were defined', async () => {
          connection.define(
            'elements',
            {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
              },
              name: {
                type: DataTypes.TEXT,
                allowNull: false,
              },
              zzzzName: {
                type: DataTypes.TEXT,
              },
              aaaaName: {
                type: DataTypes.TEXT,
              },
              age: {
                type: DataTypes.INTEGER,
              },
            },
            { paranoid: false, createdAt: false, updatedAt: false },
          );
          await connection.sync({ force: true });

          const dialect = dialectFactory();

          const tableNames = [{ schema: connectionDetails.defaultSchema, tableName: 'elements' }];

          const tableColumns = await dialect.listColumns(tableNames, connection);

          expect(tableColumns).toEqual([
            [
              expect.objectContaining({ name: 'id' }),
              expect.objectContaining({ name: 'name' }),
              expect.objectContaining({ name: 'zzzzName' }),
              expect.objectContaining({ name: 'aaaaName' }),
              expect.objectContaining({ name: 'age' }),
            ],
          ]);
        });

        describe('default values', () => {
          describe('for texts', () => {
            it.each([
              'default value',
              "default 'value'",
              "default ''value''",
              "default '''value'''",
              'default "value"',
              'value::foobar',
              'null',
              'false',
              null,
              'null',
            ])('should return %s as default value (not literal)', async defaultValue => {
              connection.define(
                'elements',
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  name: {
                    type: DataTypes.TEXT,
                    defaultValue,
                  },
                },
                { paranoid: false, createdAt: false, updatedAt: false },
              );
              await connection.sync({ force: true });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'name',
                    defaultValue,
                    isLiteralDefaultValue: false,
                  }),
                ]),
              ]);
            });

            it('should return null as a default value if none is defined', async () => {
              connection.define(
                'elements',
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  name: {
                    type: DataTypes.TEXT,
                  },
                },
                { paranoid: false, createdAt: false, updatedAt: false },
              );
              await connection.sync({ force: true });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'name',
                    defaultValue: null,
                    isLiteralDefaultValue: false,
                  }),
                ]),
              ]);
            });

            it('should return a literal default value if it is a function', async () => {
              connection.define(
                'elements',
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  name: {
                    type: DataTypes.TEXT,
                    defaultValue: Sequelize.literal(dialectSql.now),
                  },
                },
                { paranoid: false, createdAt: false, updatedAt: false },
              );
              await connection.sync({ force: true });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'name',
                    defaultValue: dialectSql.now,
                    isLiteralDefaultValue: true,
                  }),
                ]),
              ]);
            });
          });

          describe('for decimal numbers', () => {
            it.each([0, 1, -0.5, 42_000_000])(
              `should return %s as default value (not literal)`,
              async defaultValue => {
                connection.define(
                  'elements',
                  {
                    id: {
                      type: DataTypes.INTEGER,
                      primaryKey: true,
                      autoIncrement: true,
                    },
                    name: {
                      type: DataTypes.DECIMAL,
                      defaultValue,
                    },
                  },
                  { paranoid: false, createdAt: false, updatedAt: false },
                );
                await connection.sync({ force: true });

                const dialect = dialectFactory();

                const tableNames = [
                  { schema: connectionDetails.defaultSchema, tableName: 'elements' },
                ];

                const tableColumns = await dialect.listColumns(tableNames, connection);

                expect(tableColumns).toEqual([
                  expect.arrayContaining([
                    expect.objectContaining({
                      name: 'name',
                      defaultValue: defaultValue.toString(),
                      isLiteralDefaultValue: false,
                    }),
                  ]),
                ]);
              },
            );
          });

          describe('for booleans', () => {
            it('should return false if no default value is defined', async () => {
              if (!connectionDetails.supports.booleans) {
                // eslint-disable-next-line jest/no-conditional-expect
                expect.assertions(0);

                return;
              }

              connection.define(
                'elements',
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  name: {
                    type: DataTypes.BOOLEAN,
                  },
                },
                { paranoid: false, createdAt: false, updatedAt: false },
              );
              await connection.sync({ force: true });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'name',
                    defaultValue: 'false',
                    isLiteralDefaultValue: false,
                  }),
                ]),
              ]);
            });

            it.each([false, true])(
              'should return %s as default value (not literal)',
              async defaultValue => {
                if (!connectionDetails.supports.booleans) {
                  // eslint-disable-next-line jest/no-conditional-expect
                  expect.assertions(0);

                  return;
                }

                connection.define(
                  'elements',
                  {
                    id: {
                      type: DataTypes.INTEGER,
                      primaryKey: true,
                      autoIncrement: true,
                    },
                    name: {
                      type: DataTypes.BOOLEAN,
                      defaultValue,
                    },
                  },
                  { paranoid: false, createdAt: false, updatedAt: false },
                );
                await connection.sync({ force: true });

                const dialect = dialectFactory();

                const tableNames = [
                  { schema: connectionDetails.defaultSchema, tableName: 'elements' },
                ];

                const tableColumns = await dialect.listColumns(tableNames, connection);

                expect(tableColumns).toEqual([
                  expect.arrayContaining([
                    expect.objectContaining({
                      name: 'name',
                      defaultValue: defaultValue.toString(),
                      isLiteralDefaultValue: false,
                    }),
                  ]),
                ]);
              },
            );
          });

          describe('for json', () => {
            it.each([{ value: 'bar' }, { value: "bar's" }])(
              'should return %s as default value (not literal)',
              async defaultValue => {
                if (!connectionDetails.supports.json) {
                  // eslint-disable-next-line jest/no-conditional-expect
                  expect.assertions(0);

                  return;
                }

                connection.define(
                  'elements',
                  {
                    id: {
                      type: DataTypes.INTEGER,
                      primaryKey: true,
                      autoIncrement: true,
                    },
                    name: {
                      type: DataTypes.JSON,
                      defaultValue,
                    },
                  },
                  { paranoid: false, createdAt: false, updatedAt: false },
                );
                await connection.sync({ force: true });

                const dialect = dialectFactory();

                const tableNames = [
                  { schema: connectionDetails.defaultSchema, tableName: 'elements' },
                ];

                const tableColumns = await dialect.listColumns(tableNames, connection);

                expect(tableColumns).toEqual([
                  expect.arrayContaining([
                    expect.objectContaining({
                      name: 'id',
                    }),
                    expect.objectContaining({
                      name: 'name',
                      defaultValue: JSON.stringify(defaultValue),
                      isLiteralDefaultValue: false,
                    }),
                  ]),
                ]);
              },
            );
          });

          describe('for date with time', () => {
            it('should return the default now as a literal', async () => {
              connection.define(
                'elements',
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  createdAt: {
                    type: DataTypes.DATE,
                    defaultValue: Sequelize.literal(dialectSql.now),
                  },
                },
                { paranoid: false, createdAt: false, updatedAt: false },
              );
              await connection.sync({ force: true });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'createdAt',
                    defaultValue: dialectSql.now,
                    isLiteralDefaultValue: true,
                  }),
                ]),
              ]);
            });

            it('should return the specific date as a non-literal', async () => {
              connection.define(
                'elements',
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  createdAt: {
                    type: DataTypes.DATE,
                    defaultValue: new Date('2020-01-01T10:00:00+00:00'),
                  },
                },
                { paranoid: false, createdAt: false, updatedAt: false },
              );
              await connection.sync({ force: true });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'createdAt',
                    defaultValue: expect.stringMatching(/^2020-01-01\s*10:00:00/),
                    isLiteralDefaultValue: false,
                  }),
                ]),
              ]);
            });
          });

          describe('for date', () => {
            it('should return the default now as a literal', async () => {
              connection.define(
                'elements',
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  createdAt: {
                    type: DataTypes.DATEONLY,
                    defaultValue: Sequelize.literal(dialectSql.now),
                  },
                },
                { paranoid: false, createdAt: false, updatedAt: false },
              );

              await connection.sync({ force: true });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'createdAt',
                    defaultValue: dialectSql.now,
                    isLiteralDefaultValue: true,
                  }),
                ]),
              ]);
            });

            it('should return the specific date as a non-literal', async () => {
              connection.define(
                'elements',
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  createdAt: {
                    type: DataTypes.DATEONLY,
                    defaultValue: '2020-01-01',
                  },
                },
                { paranoid: false, createdAt: false, updatedAt: false },
              );
              await connection.sync({ force: true });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'createdAt',
                    defaultValue: '2020-01-01',
                    isLiteralDefaultValue: false,
                  }),
                ]),
              ]);
            });
          });

          describe('for enums', () => {
            it('should return the enum values as default value', async () => {
              connection.define(
                'elements',
                {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  mood: {
                    type: DataTypes.ENUM('sad', 'ok', 'happy'),
                    defaultValue: 'happy',
                  },
                },
                { paranoid: false, createdAt: false, updatedAt: false },
              );

              await connection.sync({ force: true });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'mood',
                    defaultValue: 'happy',
                    isLiteralDefaultValue: false,
                  }),
                ]),
              ]);
            });
          });
        });
      });
    });

    describe('with 2 tables in different schemas', () => {
      let connectionOnDefaultSchema: Sequelize;
      let connectionOnCustomSchema: Sequelize;

      beforeEach(async () => {
        await setupSchema(connectionDetails, 'other');

        connectionOnDefaultSchema = new Sequelize({
          ...connectionDetails.options(DB_NAME),
          logging: false,
          schema: connectionDetails.defaultSchema,
        });

        connectionOnCustomSchema = new Sequelize({
          ...connectionDetails.options(DB_NAME),
          logging: false,
          schema: 'other',
        });
      });

      afterEach(async () => {
        await connectionOnDefaultSchema.close();
        await connectionOnCustomSchema.close();
      });

      it('returns the tables', async () => {
        connectionOnDefaultSchema.define(
          'elements',
          {
            id1: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
          },
          { paranoid: false, createdAt: false, updatedAt: false },
        );
        connectionOnCustomSchema.define(
          'things',
          {
            id2: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
          },
          { paranoid: false, createdAt: false, updatedAt: false },
        );

        await connectionOnDefaultSchema.sync({ force: true });
        await connectionOnCustomSchema.sync({ force: false });

        const dialect = dialectFactory();

        const tableNames = [
          { schema: connectionDetails.defaultSchema, tableName: 'elements' },
          { schema: 'other', tableName: 'things' },
        ];
        const tableColumns = await dialect.listColumns(tableNames, connectionOnDefaultSchema);
        expect(tableColumns).toEqual([
          [
            expect.objectContaining({
              allowNull: false,
              autoIncrement: true,
              comment: null,
              name: 'id1',
              primaryKey: true,
              type: dialectSql.integer,
              ...dialectSql.autoIncrement(undefined, 'elements', 'id1'),
            }),
          ],
          [
            expect.objectContaining({
              allowNull: false,
              autoIncrement: true,
              comment: null,
              name: 'id2',
              primaryKey: true,
              type: dialectSql.integer,
              ...dialectSql.autoIncrement('other', 'things', 'id2'),
            }),
          ],
        ]);
      });

      it('should return only info from the table in the right schema', async () => {
        connectionOnDefaultSchema.define(
          'elements',
          {
            id1: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
          },
          { paranoid: false, createdAt: false, updatedAt: false },
        );
        connectionOnCustomSchema.define(
          'elements',
          {
            id2: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
          },
          { paranoid: false, createdAt: false, updatedAt: false },
        );

        await connectionOnDefaultSchema.sync({ force: true });
        await connectionOnCustomSchema.sync({ force: false });

        const dialect = dialectFactory();

        const tableNames = [{ schema: 'other', tableName: 'elements' }];
        const tableColumns = await dialect.listColumns(tableNames, connectionOnDefaultSchema);
        expect(tableColumns).toEqual([
          [
            expect.objectContaining({
              allowNull: false,
              autoIncrement: true,
              comment: null,
              name: 'id2',
              primaryKey: true,
              type: dialectSql.integer,
              ...dialectSql.autoIncrement('other', 'elements', 'id2'),
            }),
          ],
        ]);
      });
    });

    describe('with 2 tables on different databases', () => {
      let connection1: Sequelize;
      let connection2: Sequelize;

      beforeEach(async () => {
        await setupDB(connectionDetails, DB_NAME);
        await setupDB(connectionDetails, 'other-db');

        connection1 = new Sequelize({
          ...connectionDetails.options(DB_NAME),
          logging: false,
        });

        connection2 = new Sequelize({
          ...connectionDetails.options('other-db'),
          logging: false,
        });
      });

      afterEach(async () => {
        await connection1.close();
        await connection2.close();
      });

      it('should only return info from the table from the right database', async () => {
        connection1.define(
          'elements',
          {
            id1: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
          },
          { paranoid: false, createdAt: false, updatedAt: false },
        );
        connection2.define(
          'elements',
          {
            id2: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
          },
          { paranoid: false, createdAt: false, updatedAt: false },
        );

        await connection1.sync({ force: true });
        await connection2.sync({ force: false });

        const dialect = dialectFactory();

        const tableNames = [{ schema: connectionDetails.defaultSchema, tableName: 'elements' }];
        const tableColumns = await dialect.listColumns(tableNames, connection1);
        expect(tableColumns).toEqual([
          [
            expect.objectContaining({
              allowNull: false,
              autoIncrement: true,
              comment: null,
              name: 'id1',
              primaryKey: true,
              type: dialectSql.integer,
              ...dialectSql.autoIncrement(undefined, 'elements', 'id1'),
            }),
          ],
        ]);
      });
    });
  });
});
