import type { ConnectionDetails } from '../../_helpers/connection-details';

import { DataTypes, Sequelize } from 'sequelize';

import MariadbDialect from '../../../src/introspection/dialects/mariadb-dialect';
import MsSQLDialect from '../../../src/introspection/dialects/mssql-dialect';
import MySQLDialect from '../../../src/introspection/dialects/mysql-dialect';
import PostgreSQLDialect from '../../../src/introspection/dialects/postgresql-dialect';
import SQLiteDialect from '../../../src/introspection/dialects/sqlite-dialect';
import {
  MARIADB_DETAILS,
  MSSQL_DETAILS,
  MYSQL_DETAILS,
  POSTGRESQL_DETAILS,
  SQLITE_DETAILS,
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

async function setupDB(
  connectionDetails: ConnectionDetails,
  dbName: string | null,
  dropQuery: string | null,
) {
  const sequelize = new Sequelize({ ...connectionDetails.options(), logging: false });

  if (dropQuery && dbName) {
    await sequelize.query(dropQuery, {
      logging: false,
    });
    await sequelize.getQueryInterface().createDatabase(dbName);
  }

  await sequelize.close();
}

const mysqlSQLDialect = {
  now: 'CURRENT_TIMESTAMP',
  nowDate: '(now())',
  nowDateValue: 'now()',
  textFunctionDefaultValue: 'now()',
  autoIncrement: () => ({
    defaultValue: null,
    isLiteralDefaultValue: false,
  }),
  integer: 'INT',
  text: 'TEXT',
  varchar: length => `VARCHAR(${length})`,
  decimal: (precision: number, scale: number) => `DECIMAL(${precision},${scale})`,
  date: 'DATETIME',
  dropDb: (dbName: string) => `DROP DATABASE IF EXISTS \`${dbName}\``,
  decimalValue: (value: number) => value?.toFixed(2),
  enumType: (values: string[]) => ({
    type: `ENUM(${values.map(value => `'${value.replace(/'/g, "''")}'`).join(',')})`,
    enumValues: values,
  }),
};

describe.each([
  ...POSTGRESQL_DETAILS.map(connectionDetails => ({
    connectionDetails,
    dialectFactory: () => new PostgreSQLDialect(),
    dialectSql: {
      autoIncrement: (schema: string | undefined, tableName: string, id = 'id') => ({
        defaultValue: tableName.includes('.')
          ? `nextval('${
              schema && schema !== connectionDetails.defaultSchema ? `${schema}.` : ''
            }"${tableName}_${id}_seq"'::regclass)`
          : `nextval('${
              schema && schema !== connectionDetails.defaultSchema ? `${schema}.` : ''
            }${tableName}_${id}_seq'::regclass)`,
        isLiteralDefaultValue: true,
      }),
      now: 'now()',
      nowDate: 'now()',
      nowDateValue: 'now()',
      textFunctionDefaultValue: 'now()',
      integer: 'INTEGER',
      text: 'TEXT',
      varchar: length => `CHARACTER VARYING(${length})`,
      decimal: (precision: number, scale: number) => `NUMERIC(${precision},${scale})`,
      date: 'TIMESTAMP WITH TIME ZONE',
      dropDb: (dbName: string) => `DROP DATABASE IF EXISTS "${dbName}"`,
      decimalValue: (value: number) => `${value}`,
      enumType: (values: string[]) => ({
        type: 'USER-DEFINED',
        special: values,
        enumValues: values,
      }),
    },
  })),
  ...MSSQL_DETAILS.map(connectionDetails => ({
    connectionDetails,
    dialectFactory: () => new MsSQLDialect(),
    dialectSql: {
      now: 'getdate()',
      nowDate: 'getdate()',
      nowDateValue: 'getdate()',
      textFunctionDefaultValue: 'getdate()',
      autoIncrement: () => ({
        defaultValue: null,
        isLiteralDefaultValue: false,
      }),
      integer: 'INT',
      text: 'NVARCHAR(MAX)',
      varchar: length => `NVARCHAR(${length})`,
      decimal: (precision: number, scale: number) => `DECIMAL(${precision},${scale})`,
      date: 'DATETIMEOFFSET',
      dropDb: (dbName: string) => `DROP DATABASE IF EXISTS [${dbName}]`,
      decimalValue: (value: number) => `${value}`,
      enumType: () => ({
        type: `VARCHAR(255)`,
      }),
    },
  })),
  ...MYSQL_DETAILS.map(connectionDetails => ({
    connectionDetails,
    dialectFactory: () => new MySQLDialect(),
    dialectSql:
      connectionDetails.version >= 8
        ? mysqlSQLDialect
        : {
            ...mysqlSQLDialect,
            integer: 'INT(11)',
          },
  })),
  ...MARIADB_DETAILS.map(connectionDetails => ({
    connectionDetails,
    dialectFactory: () => new MariadbDialect(),
    dialectSql:
      connectionDetails.version < 10
        ? mysqlSQLDialect
        : {
            ...mysqlSQLDialect,
            now: 'current_timestamp()',
            nowDate: 'current_timestamp()',
            nowDateValue: 'current_timestamp()',
            textFunctionDefaultValue: 'current_timestamp()',
            integer: 'INT(11)',
          },
  })),
  {
    connectionDetails: SQLITE_DETAILS,
    dialectFactory: () => new SQLiteDialect(),
    dialectSql: {
      autoIncrement: () => ({
        defaultValue: null,
        isLiteralDefaultValue: false,
      }),
      now: 'CURRENT_TIMESTAMP',
      nowDate: '(CURRENT_TIMESTAMP)',
      nowDateValue: 'CURRENT_TIMESTAMP',
      textFunctionDefaultValue: 'CURRENT_TIMESTAMP',
      integer: 'INTEGER',
      text: 'TEXT',
      varchar: length => `VARCHAR(${length})`,
      decimal: (precision: number, scale: number) => `DECIMAL(${precision},${scale})`,
      date: 'DATETIME',
      dropDb: () => null,
      decimalValue: (value: number) => `${value}`,
      enumType: () => ({}),
    },
  },
])('$connectionDetails.name dialect', ({ connectionDetails, dialectFactory, dialectSql }) => {
  beforeEach(async () => {
    await setupDB(connectionDetails, DB_NAME, dialectSql.dropDb(DB_NAME));
  });

  describe('describeTables', () => {
    describe('with one table', () => {
      if (connectionDetails.supports.schemas) {
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
                await connection.getQueryInterface().dropTable({ tableName: 'elements', schema });
                await connection.getQueryInterface().createTable(
                  { tableName: 'elements', schema },
                  {
                    id: {
                      type: DataTypes.INTEGER,
                      primaryKey: true,
                      autoIncrement: true,
                    },
                  },
                );

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
      }

      describe(`on default schema`, () => {
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
          await connection.getQueryInterface().dropTable('elements');
          await connection.getQueryInterface().createTable('elements', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            name: {
              type: DataTypes.TEXT,
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
          });

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
          describe.each([DataTypes.TEXT, DataTypes.STRING(100), DataTypes.CHAR(100)])(
            `for type %s`,
            type => {
              if (connectionDetails.supports.textDefaultValue || type !== DataTypes.TEXT) {
                it.each([
                  'default value',
                  "default 'value'",
                  "default ''value''",
                  "default '''value'''",
                  'default "value"',
                  'default \\ value',
                  'value::foobar',
                  'null',
                  'false',
                  null,
                  'NULL',
                  'thisIsNotAFunction()',
                ])('should return %s as default value (not literal)', async defaultValue => {
                  if (connectionDetails.dialect === 'sqlite') {
                    // Sequelize's bugs: the string false
                    // is interpreted as 0 when creating the table
                    await connection.query(`DROP TABLE IF EXISTS elements;`);

                    await connection.query(
                      `CREATE TABLE elements (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      name ${type} DEFAULT :defaultValue
                    );`,
                      {
                        replacements: {
                          defaultValue,
                        },
                      },
                    );
                  } else {
                    await connection.getQueryInterface().dropTable('elements');
                    await connection.getQueryInterface().createTable('elements', {
                      id: {
                        type: DataTypes.INTEGER,
                        primaryKey: true,
                        autoIncrement: true,
                      },
                      name: {
                        type,
                        defaultValue,
                      },
                    });

                    // MariaDB supports default values for texts
                    // but Sequelize does not know about it
                    if (connectionDetails.dialect === 'mariadb' && type === DataTypes.TEXT) {
                      await connection.query(
                        `ALTER TABLE elements ALTER name SET DEFAULT :defaultValue`,
                        {
                          replacements: {
                            defaultValue,
                          },
                        },
                      );
                    }
                  }

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

                if (connectionDetails.supports.functionDefaultValue) {
                  it('should return a literal default value if it is a function', async () => {
                    if (connectionDetails.dialect === 'mysql') {
                      await connection.query(`DROP TABLE IF EXISTS elements;`);
                      await connection.query(`
                      CREATE TABLE elements (
                          id INTEGER PRIMARY KEY AUTO_INCREMENT,
                          name VARCHAR(255) DEFAULT (now())
                        );
                      `);
                    } else {
                      await connection.getQueryInterface().dropTable('elements');
                      await connection.getQueryInterface().createTable('elements', {
                        id: {
                          type: DataTypes.INTEGER,
                          primaryKey: true,
                          autoIncrement: true,
                        },
                        name: {
                          type,
                          defaultValue: Sequelize.literal(dialectSql.textFunctionDefaultValue),
                        },
                      });

                      // MariaDB supports default values for texts
                      // but Sequelize does not know about it
                      if (connectionDetails.dialect === 'mariadb') {
                        await connection.query(
                          `ALTER TABLE elements ALTER name SET DEFAULT (current_timestamp())`,
                        );
                      }
                    }

                    const dialect = dialectFactory();

                    const tableNames = [
                      { schema: connectionDetails.defaultSchema, tableName: 'elements' },
                    ];

                    const tableColumns = await dialect.listColumns(tableNames, connection);

                    expect(tableColumns).toEqual([
                      expect.arrayContaining([
                        expect.objectContaining({
                          name: 'name',
                          defaultValue: dialectSql.textFunctionDefaultValue,
                          isLiteralDefaultValue: true,
                        }),
                      ]),
                    ]);
                  });
                }
              }

              it('should return null as a default value if none is defined', async () => {
                await connection.getQueryInterface().dropTable('elements');
                await connection.getQueryInterface().createTable('elements', {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  name: {
                    type,
                  },
                });

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
            },
          );

          describe('for decimal numbers', () => {
            it.each([0, 1, -0.5, 42_000_000])(
              `should return %s as default value (not literal)`,
              async defaultValue => {
                await connection.getQueryInterface().dropTable('elements');
                await connection.getQueryInterface().createTable('elements', {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  name: {
                    type: DataTypes.DECIMAL(10, 2),
                    defaultValue,
                  },
                });

                const dialect = dialectFactory();

                const tableNames = [
                  { schema: connectionDetails.defaultSchema, tableName: 'elements' },
                ];

                const tableColumns = await dialect.listColumns(tableNames, connection);

                expect(tableColumns).toEqual([
                  expect.arrayContaining([
                    expect.objectContaining({
                      name: 'name',
                      defaultValue: dialectSql.decimalValue(defaultValue),
                      isLiteralDefaultValue: false,
                    }),
                  ]),
                ]);
              },
            );
          });

          if (connectionDetails.supports.booleans) {
            describe('for booleans', () => {
              it('should return false if no default value is defined', async () => {
                await connection.getQueryInterface().dropTable('elements');
                await connection.getQueryInterface().createTable('elements', {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  name: {
                    type: DataTypes.BOOLEAN,
                  },
                });

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
                  await connection.getQueryInterface().dropTable('elements');
                  await connection.getQueryInterface().createTable('elements', {
                    id: {
                      type: DataTypes.INTEGER,
                      primaryKey: true,
                      autoIncrement: true,
                    },
                    name: {
                      type: DataTypes.BOOLEAN,
                      defaultValue,
                    },
                  });

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
          }

          if (connectionDetails.supports.json) {
            describe('for json', () => {
              it.each([{ value: 'bar' }, { value: "bar's" }])(
                'should return %s as default value (not literal)',
                async defaultValue => {
                  await connection.getQueryInterface().dropTable('elements');
                  await connection.getQueryInterface().createTable('elements', {
                    id: {
                      type: DataTypes.INTEGER,
                      primaryKey: true,
                      autoIncrement: true,
                    },
                    name: {
                      type: DataTypes.JSON,
                      defaultValue,
                    },
                  });

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
          }

          describe('for date with time', () => {
            it('should return the default now as a literal', async () => {
              await connection.getQueryInterface().dropTable('elements');
              await connection.getQueryInterface().createTable('elements', {
                id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
                },
                createdAt: {
                  type: DataTypes.DATE,
                  defaultValue: Sequelize.literal(dialectSql.now),
                },
              });

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
              await connection.getQueryInterface().dropTable('elements');
              await connection.getQueryInterface().createTable('elements', {
                id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
                },
                createdAt: {
                  type: DataTypes.DATE,
                  defaultValue: new Date('2020-01-01T10:00:00+00:00'),
                },
              });

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
            if (connectionDetails.supports.dateDefault) {
              it('should return the default now as a literal', async () => {
                await connection.getQueryInterface().dropTable('elements');
                await connection.getQueryInterface().createTable('elements', {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  createdAt: {
                    type: DataTypes.DATEONLY,
                    defaultValue: Sequelize.literal(dialectSql.nowDate),
                  },
                });

                const dialect = dialectFactory();

                const tableNames = [
                  { schema: connectionDetails.defaultSchema, tableName: 'elements' },
                ];

                const tableColumns = await dialect.listColumns(tableNames, connection);

                expect(tableColumns).toEqual([
                  expect.arrayContaining([
                    expect.objectContaining({
                      name: 'createdAt',
                      defaultValue: dialectSql.nowDateValue,
                      isLiteralDefaultValue: true,
                    }),
                  ]),
                ]);
              });
            }

            it('should return the specific date as a non-literal', async () => {
              await connection.getQueryInterface().dropTable('elements');
              await connection.getQueryInterface().createTable('elements', {
                id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
                },
                createdAt: {
                  type: DataTypes.DATEONLY,
                  defaultValue: '2020-01-01',
                },
              });

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
              // Bug in Sequelize that does not declare the default value
              if (connectionDetails.dialect === 'mssql') {
                await connection.query(
                  `IF OBJECT_ID('[elements]', 'U') IS NOT NULL DROP TABLE [elements];`,
                );
                await connection.query(`
                  CREATE TABLE [elements] (
                    [id] INTEGER IDENTITY(1,1) ,
                    [mood] VARCHAR(255) 
                      CHECK ([mood] IN(N'sad', N'ok', N'happy'))
                      DEFAULT N'happy',
                    PRIMARY KEY ([id])
                  );
                `);
              } else {
                await connection.getQueryInterface().dropTable('elements');
                await connection.getQueryInterface().createTable('elements', {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  mood: {
                    type: DataTypes.ENUM('sad', 'ok', 'happy'),
                    defaultValue: 'happy',
                  },
                });
              }

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

          if (connectionDetails.supports.arrays) {
            describe('for arrays', () => {
              it('should return the array values as default value', async () => {
                await connection.getQueryInterface().dropTable('elements');
                await connection.getQueryInterface().createTable('elements', {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  mood: {
                    type: DataTypes.ARRAY(DataTypes.TEXT),
                    defaultValue: ['happy', 'sad'],
                  },
                });

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
                      name: 'mood',
                      defaultValue: "ARRAY['happy'::text, 'sad'::text]",
                      isLiteralDefaultValue: true,
                      type: 'ARRAY',
                    }),
                  ]),
                ]);
              });
            });
          }
        });

        describe('types', () => {
          describe('integer', () => {
            it('should correctly detect autoincrement', async () => {
              await connection.getQueryInterface().dropTable('elements');
              await connection.getQueryInterface().createTable('elements', {
                id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
                },
              });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                [
                  expect.objectContaining({
                    name: 'id',
                    type: dialectSql.integer,
                    autoIncrement: true,
                  }),
                ],
              ]);
            });

            it('should set autoincrement to false for other columns', async () => {
              await connection.getQueryInterface().dropTable('elements');
              await connection.getQueryInterface().createTable('elements', {
                id: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
                },
                value: {
                  type: DataTypes.INTEGER,
                },
              });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                [
                  expect.objectContaining({
                    name: 'id',
                    type: dialectSql.integer,
                    autoIncrement: true,
                  }),
                  expect.objectContaining({
                    name: 'value',
                    type: dialectSql.integer,
                    autoIncrement: false,
                  }),
                ],
              ]);
            });

            it('should not set autoincrement if the id is not auto incremented', async () => {
              await connection.getQueryInterface().dropTable('elements');
              await connection.getQueryInterface().createTable('elements', {
                id: {
                  autoIncrement: false,
                  primaryKey: true,
                  type: DataTypes.INTEGER,
                },
              });

              const dialect = dialectFactory();

              const tableNames = [
                { schema: connectionDetails.defaultSchema, tableName: 'elements' },
              ];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                [
                  expect.objectContaining({
                    name: 'id',
                    type: dialectSql.integer,
                    autoIncrement: false,
                  }),
                ],
              ]);
            });
          });

          it.each([
            [DataTypes.TEXT, dialectSql.text],
            [DataTypes.STRING(12), dialectSql.varchar(12)],
            [DataTypes.INTEGER, dialectSql.integer],
            [DataTypes.DATE, dialectSql.date],
          ])('should detect %s as %s', async (type, expected) => {
            await connection.getQueryInterface().dropTable('elements');
            await connection.getQueryInterface().createTable('elements', {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
              },
              test: type,
            });

            const dialect = dialectFactory();

            const tableNames = [{ schema: connectionDetails.defaultSchema, tableName: 'elements' }];

            const tableColumns = await dialect.listColumns(tableNames, connection);

            expect(tableColumns).toEqual([
              [
                expect.objectContaining({ name: 'id' }),
                expect.objectContaining({
                  name: 'test',
                  type: expected,
                  autoIncrement: false,
                  allowNull: true,
                }),
              ],
            ]);
          });

          if (connectionDetails.supports.enums) {
            describe('enum', () => {
              it('should correctly detect enums', async () => {
                await connection.getQueryInterface().dropTable('elements');
                await connection.getQueryInterface().createTable('elements', {
                  id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true,
                    autoIncrement: true,
                  },
                  mood: {
                    type: DataTypes.ENUM('sad', 'ok', 'happy', 'bug,\'y"value'),
                  },
                });

                const dialect = dialectFactory();

                const tableNames = [
                  { schema: connectionDetails.defaultSchema, tableName: 'elements' },
                ];

                const tableColumns = await dialect.listColumns(tableNames, connection);

                expect(tableColumns).toEqual([
                  [
                    expect.objectContaining({ name: 'id' }),
                    expect.objectContaining({
                      name: 'mood',
                      ...dialectSql.enumType(['sad', 'ok', 'happy', 'bug,\'y"value']),
                    }),
                  ],
                ]);
              });

              if (connectionDetails.supports.arrays) {
                describe('array of enums', () => {
                  it('should correctly detect array of enums', async () => {
                    await connection.getQueryInterface().dropTable('elements');
                    await connection.getQueryInterface().createTable('elements', {
                      id: {
                        type: DataTypes.INTEGER,
                        primaryKey: true,
                        autoIncrement: true,
                      },
                      mood: {
                        type: DataTypes.ARRAY(
                          DataTypes.ENUM('sad', 'ok', 'happy', 'bug,\'y"value'),
                        ),
                      },
                    });

                    const dialect = dialectFactory();

                    const tableNames = [
                      { schema: connectionDetails.defaultSchema, tableName: 'elements' },
                    ];

                    const tableColumns = await dialect.listColumns(tableNames, connection);

                    expect(tableColumns).toEqual([
                      [
                        expect.objectContaining({ name: 'id' }),
                        expect.objectContaining({
                          name: 'mood',
                          ...dialectSql.enumType(['sad', 'ok', 'happy', 'bug,\'y"value']),
                          type: 'ARRAY',
                        }),
                      ],
                    ]);
                  });

                  it('should correctly detect array of enums when the table name contains uppercase chararacters', async () => {
                    await connection.getQueryInterface().dropTable('importantElements');
                    await connection.getQueryInterface().createTable('importantElements', {
                      id: {
                        type: DataTypes.INTEGER,
                        primaryKey: true,
                        autoIncrement: true,
                      },
                      mood: {
                        type: DataTypes.ARRAY(
                          DataTypes.ENUM('sad', 'ok', 'happy', 'bug,\'y"value'),
                        ),
                      },
                    });

                    const dialect = dialectFactory();

                    const tableNames = [
                      { schema: connectionDetails.defaultSchema, tableName: 'importantElements' },
                    ];

                    const tableColumns = await dialect.listColumns(tableNames, connection);

                    expect(tableColumns).toEqual([
                      [
                        expect.objectContaining({ name: 'id' }),
                        expect.objectContaining({
                          name: 'mood',
                          ...dialectSql.enumType(['sad', 'ok', 'happy', 'bug,\'y"value']),
                          type: 'ARRAY',
                        }),
                      ],
                    ]);
                  });
                });
              }
            });
          }

          if (connectionDetails.supports.arrays) {
            describe('array', () => {
              describe('of integers', () => {
                it('should correctly detect arrays of integers', async () => {
                  await connection.getQueryInterface().dropTable('elements');
                  await connection.getQueryInterface().createTable('elements', {
                    id: {
                      type: DataTypes.INTEGER,
                      primaryKey: true,
                      autoIncrement: true,
                    },
                    values: {
                      type: DataTypes.ARRAY(DataTypes.INTEGER),
                    },
                  });

                  const dialect = dialectFactory();

                  const tableNames = [
                    { schema: connectionDetails.defaultSchema, tableName: 'elements' },
                  ];

                  const tableColumns = await dialect.listColumns(tableNames, connection);

                  expect(tableColumns).toEqual([
                    [
                      expect.objectContaining({ name: 'id' }),
                      expect.objectContaining({
                        name: 'values',
                        type: 'ARRAY',
                        elementType: dialectSql.integer,
                      }),
                    ],
                  ]);
                });
              });

              describe('of decimals', () => {
                it('should correctly detect arrays of decimals', async () => {
                  await connection.getQueryInterface().dropTable('elements');
                  await connection.getQueryInterface().createTable('elements', {
                    id: {
                      type: DataTypes.INTEGER,
                      primaryKey: true,
                      autoIncrement: true,
                    },
                    values: {
                      type: DataTypes.ARRAY(DataTypes.DECIMAL(10, 2)),
                    },
                  });

                  const dialect = dialectFactory();

                  const tableNames = [
                    { schema: connectionDetails.defaultSchema, tableName: 'elements' },
                  ];

                  const tableColumns = await dialect.listColumns(tableNames, connection);

                  expect(tableColumns).toEqual([
                    [
                      expect.objectContaining({ name: 'id' }),
                      expect.objectContaining({
                        name: 'values',
                        type: 'ARRAY',
                        elementType: dialectSql.decimal(10, 2),
                      }),
                    ],
                  ]);
                });
              });
            });
          }
        });

        it('returns the table even if it has dots in the name', async () => {
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
            {
              schema: connectionDetails.defaultSchema,
              paranoid: false,
              createdAt: false,
              updatedAt: false,
              tableName: 'nice.elements',
            },
          );
          await connection.sync({ force: true });

          const tableNames = [
            { schema: connectionDetails.defaultSchema, tableName: 'nice.elements' },
          ];
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
                ...dialectSql.autoIncrement(connectionDetails.defaultSchema, 'nice.elements'),
              }),
            ],
          ]);
        });
      });
    });

    if (connectionDetails.supports.schemas) {
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
    }

    if (connectionDetails.supports.multipleDatabases) {
      describe('with 2 tables on different databases', () => {
        let connection1: Sequelize;
        let connection2: Sequelize;

        beforeEach(async () => {
          await setupDB(connectionDetails, DB_NAME, dialectSql.dropDb(DB_NAME));
          await setupDB(connectionDetails, 'other-db', dialectSql.dropDb('other-db'));

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
    }

    if (connectionDetails.supports.multipleDatabases) {
      describe('when the database name is not provided', () => {
        it('should throw an error if the database name is not provided', async () => {
          const sequelize = new Sequelize(connectionDetails.url(), { logging: false });

          const dialect = dialectFactory();

          const tableNames = [];

          await expect(dialect.listColumns(tableNames, sequelize)).rejects.toThrow(
            'Database name is required. Please check your connection settings.',
          );
        });
      });
    }
  });
});
