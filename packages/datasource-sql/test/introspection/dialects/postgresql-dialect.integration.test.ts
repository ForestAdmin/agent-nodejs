import { Sequelize } from 'sequelize';

import PostgreSQLDialect from '../../../src/introspection/dialects/postgresql-dialect';
import { POSTGRESQL_DETAILS } from '../../_helpers/connection-details';

const DB_NAME = 'dialect-test-db';

async function setupSchema(schema: string | undefined) {
  if (!schema || schema === 'public') return;

  const sequelize = new Sequelize({
    ...POSTGRESQL_DETAILS.options(DB_NAME),
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

async function setupDB(dbName: string) {
  const sequelize = new Sequelize({ ...POSTGRESQL_DETAILS.options(), logging: false });

  await sequelize.query(`DROP DATABASE IF EXISTS "${dbName}"`, {
    logging: false,
  });
  await sequelize.getQueryInterface().createDatabase(dbName);
  await sequelize.close();
}

describe('PostgreSQL dialect', () => {
  beforeEach(async () => {
    await setupDB(DB_NAME);
  });

  describe('describeTables', () => {
    describe('with one table', () => {
      describe('with specific schemas', () => {
        describe.each(['public', 'other', undefined])('with schema %s', schema => {
          let connection: Sequelize;

          beforeEach(async () => {
            await setupSchema(schema);

            connection = new Sequelize({
              ...POSTGRESQL_DETAILS.options(DB_NAME),
              logging: false,
              schema,
            });
          });

          afterEach(async () => {
            await connection.close();
          });

          it('returns the table', async () => {
            const dialect = new PostgreSQLDialect();

            await connection.query(`CREATE TABLE "${schema || 'public'}"."table1" (
              id SERIAL PRIMARY KEY
            );`);

            const tableNames = [{ schema, tableName: 'table1' }];
            const tableColumns = await dialect.listColumns(tableNames, connection);
            expect(tableColumns).toEqual([
              [
                {
                  allowNull: false,
                  autoIncrement: true,
                  comment: null,
                  defaultValue: `nextval('${
                    schema === 'other' ? 'other.' : ''
                  }table1_id_seq'::regclass)`,
                  isLiteralDefaultValue: true,
                  name: 'id',
                  primaryKey: true,
                  type: 'INTEGER',
                  special: [],
                },
              ],
            ]);
          });
        });
      });

      describe('on public', () => {
        let connection: Sequelize;

        beforeEach(async () => {
          await setupSchema('other');

          connection = new Sequelize({
            ...POSTGRESQL_DETAILS.options(DB_NAME),
            logging: false,
          });
        });

        afterEach(async () => {
          await connection.close();
        });

        it('should return columns in the order they were defined', async () => {
          await connection.query(`CREATE TABLE table1 (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            "zzzzName" VARCHAR(255) NOT NULL,
            "aaaaName" VARCHAR(255) NOT NULL,
            age INTEGER
          );`);

          const dialect = new PostgreSQLDialect();

          const tableNames = [{ schema: 'public', tableName: 'table1' }];

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
              'default "value"',
              'value::foobar',
              'null',
              'false',
              null,
              'null',
            ])('should return %s as default value (not literal)', async defaultValue => {
              await connection.query(
                `CREATE TABLE table1 (
                id SERIAL PRIMARY KEY,
                name TEXT DEFAULT :defaultValue
              );`,
                {
                  replacements: { defaultValue },
                },
              );

              const dialect = new PostgreSQLDialect();

              const tableNames = [{ schema: 'public', tableName: 'table1' }];

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
              await connection.query(
                `CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  name TEXT
                );`,
              );

              const dialect = new PostgreSQLDialect();

              const tableNames = [{ schema: 'public', tableName: 'table1' }];

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
              await connection.query(
                `CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  name TEXT DEFAULT now()
                );`,
              );

              const dialect = new PostgreSQLDialect();

              const tableNames = [{ schema: 'public', tableName: 'table1' }];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'name',
                    defaultValue: 'now()',
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
                await connection.query(
                  `CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  name DECIMAL DEFAULT :defaultValue
                );`,
                  {
                    replacements: { defaultValue },
                  },
                );

                const dialect = new PostgreSQLDialect();

                const tableNames = [{ schema: 'public', tableName: 'table1' }];

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
              await connection.query(
                `CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  name BOOLEAN
                );`,
              );

              const dialect = new PostgreSQLDialect();

              const tableNames = [{ schema: 'public', tableName: 'table1' }];

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
                await connection.query(
                  `CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  name BOOLEAN DEFAULT :defaultValue
                );`,
                  {
                    replacements: { defaultValue },
                  },
                );

                const dialect = new PostgreSQLDialect();

                const tableNames = [{ schema: 'public', tableName: 'table1' }];

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
            it.each([JSON.stringify({ value: 'bar' }), JSON.stringify({ value: "bar's" })])(
              'should return %s as default value (not literal)',
              async defaultValue => {
                await connection.query(
                  `CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  name JSON DEFAULT :defaultValue
                );`,
                  {
                    replacements: { defaultValue },
                  },
                );

                const dialect = new PostgreSQLDialect();

                const tableNames = [{ schema: 'public', tableName: 'table1' }];

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
              },
            );
          });

          describe('for date with time', () => {
            it('should return the default now as a literal', async () => {
              await connection.query(
                `CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  "createdAt" TIMESTAMP DEFAULT now()
                );`,
              );

              const dialect = new PostgreSQLDialect();

              const tableNames = [{ schema: 'public', tableName: 'table1' }];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'createdAt',
                    defaultValue: 'now()',
                    isLiteralDefaultValue: true,
                  }),
                ]),
              ]);
            });

            it('should return the specific date as a non-literal', async () => {
              await connection.query(
                `CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  "createdAt" TIMESTAMP with time zone DEFAULT '2020-01-01 10:00:00+00'
                );`,
              );

              const dialect = new PostgreSQLDialect();

              const tableNames = [{ schema: 'public', tableName: 'table1' }];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'createdAt',
                    defaultValue: '2020-01-01 10:00:00+00',
                    isLiteralDefaultValue: false,
                  }),
                ]),
              ]);
            });
          });

          describe('for date', () => {
            it('should return the default now as a literal', async () => {
              await connection.query(
                `CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  "createdAt" DATE DEFAULT now()
                );`,
              );

              const dialect = new PostgreSQLDialect();

              const tableNames = [{ schema: 'public', tableName: 'table1' }];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'createdAt',
                    defaultValue: 'now()',
                    isLiteralDefaultValue: true,
                  }),
                ]),
              ]);
            });

            it('should return the specific date as a non-literal', async () => {
              await connection.query(
                `CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  "createdAt" DATE DEFAULT '2020-01-01'
                );`,
              );

              const dialect = new PostgreSQLDialect();

              const tableNames = [{ schema: 'public', tableName: 'table1' }];

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
              await connection.query(
                `CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy'); CREATE TABLE table1 (
                  id SERIAL PRIMARY KEY,
                  name mood DEFAULT 'happy'
                );`,
              );

              const dialect = new PostgreSQLDialect();

              const tableNames = [{ schema: 'public', tableName: 'table1' }];

              const tableColumns = await dialect.listColumns(tableNames, connection);

              expect(tableColumns).toEqual([
                expect.arrayContaining([
                  expect.objectContaining({
                    name: 'name',
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
      let connection: Sequelize;

      beforeEach(async () => {
        await setupSchema('other');

        connection = new Sequelize({
          ...POSTGRESQL_DETAILS.options(DB_NAME),
          logging: false,
        });
      });

      afterEach(async () => {
        await connection.close();
      });

      it('returns the tables', async () => {
        await connection.query(`CREATE TABLE table1 (
          id1 SERIAL PRIMARY KEY
        );`);
        await connection.query(`CREATE TABLE other.table2 (
          id2 SERIAL PRIMARY KEY
        );`);

        const dialect = new PostgreSQLDialect();

        const tableNames = [
          { schema: 'public', tableName: 'table1' },
          { schema: 'other', tableName: 'table2' },
        ];
        const tableColumns = await dialect.listColumns(tableNames, connection);
        expect(tableColumns).toEqual([
          [
            {
              allowNull: false,
              autoIncrement: true,
              comment: null,
              defaultValue: "nextval('table1_id1_seq'::regclass)",
              isLiteralDefaultValue: true,
              name: 'id1',
              primaryKey: true,
              type: 'INTEGER',
              special: [],
            },
          ],
          [
            {
              allowNull: false,
              autoIncrement: true,
              comment: null,
              defaultValue: "nextval('other.table2_id2_seq'::regclass)",
              isLiteralDefaultValue: true,
              name: 'id2',
              primaryKey: true,
              type: 'INTEGER',
              special: [],
            },
          ],
        ]);
      });

      it('should return only info from the table in the right schema', async () => {
        await connection.query(`
          CREATE TABLE table1 (
            id1 SERIAL PRIMARY KEY
          );
          CREATE TABLE other.table1 (
            id2 SERIAL PRIMARY KEY
          );
        `);

        const dialect = new PostgreSQLDialect();

        const tableNames = [{ schema: 'other', tableName: 'table1' }];
        const tableColumns = await dialect.listColumns(tableNames, connection);
        expect(tableColumns).toEqual([
          [
            {
              allowNull: false,
              autoIncrement: true,
              comment: null,
              defaultValue: "nextval('other.table1_id2_seq'::regclass)",
              isLiteralDefaultValue: true,
              name: 'id2',
              primaryKey: true,
              type: 'INTEGER',
              special: [],
            },
          ],
        ]);
      });
    });

    describe('with 2 tables on different databases', () => {
      it('should only return info from the table from the right database', async () => {
        await setupSchema(DB_NAME);
        await setupDB('other-db');

        const connection1 = new Sequelize({
          ...POSTGRESQL_DETAILS.options(DB_NAME),
          logging: false,
        });

        const connection2 = new Sequelize({
          ...POSTGRESQL_DETAILS.options('other-db'),
          logging: false,
        });

        await connection1.query(`CREATE TABLE table1 (
          id1 SERIAL PRIMARY KEY
        );`);
        await connection2.query(`CREATE TABLE table1 (
          id2 SERIAL PRIMARY KEY
        );`);

        const dialect = new PostgreSQLDialect();

        const tableNames = [{ schema: 'public', tableName: 'table1' }];
        const tableColumns = await dialect.listColumns(tableNames, connection1);
        expect(tableColumns).toEqual([
          [
            {
              allowNull: false,
              autoIncrement: true,
              comment: null,
              defaultValue: "nextval('table1_id1_seq'::regclass)",
              isLiteralDefaultValue: true,
              name: 'id1',
              primaryKey: true,
              type: 'INTEGER',
              special: [],
            },
          ],
        ]);
      });
    });
  });
});
