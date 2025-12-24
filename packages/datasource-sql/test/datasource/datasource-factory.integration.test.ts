import type { SequelizeDataSource } from '@forestadmin/datasource-sequelize';
import type { Dialect, Model, ModelStatic } from 'sequelize';

import { Projection } from '@forestadmin/datasource-toolkit';
import { caller, filter } from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { stringify } from 'querystring';
import { DataTypes, Op, Sequelize } from 'sequelize';

import { buildSequelizeInstance, createSqlDataSource, introspect } from '../../src';
import Introspector from '../../src/introspection/introspector';
import { CONNECTION_DETAILS } from '../_helpers/connection-details';
import setupEmptyDatabase from '../_helpers/setup-empty-database';
import setupDatabaseWithIdNotPrimary from '../_helpers/setup-id-is-not-a-pk';
import setupSimpleTable from '../_helpers/setup-simple-table';
import setupSoftDeleted from '../_helpers/setup-soft-deleted';
import setupDatabaseWithTypes, { getAttributeMapping } from '../_helpers/setup-using-all-types';
import setupDatabaseWithRelations, { RELATION_MAPPING } from '../_helpers/setup-using-relations';

function extractTablesAndRelations(
  models: Sequelize['models'],
): Record<string, Record<string, string>> {
  return Object.entries(models).reduce(
    (modelsAccumulator, [name, model]) => ({
      ...modelsAccumulator,
      [name]: Object.entries(model.associations).reduce(
        (associations, [key, value]) => ({
          ...associations,
          [key]: value.associationType,
        }),
        {},
      ),
    }),
    {},
  );
}

describe('SqlDataSourceFactory > Integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe.each(
    CONNECTION_DETAILS.flatMap(connectionDetails => [
      { connectionDetails, schema: undefined },
      ...(connectionDetails.supports.schemas
        ? [
            {
              connectionDetails,
              schema: 'test_schema',
            },
          ]
        : []),
    ]),
  )('on $connectionDetails.name database', ({ connectionDetails, schema }) => {
    const queryParams = schema ? { schema } : {};
    const queryString = stringify(queryParams);

    describe(`when schema is ${schema}`, () => {
      describe('Connecting with different options', () => {
        const logger = jest.fn();

        it('using uri', async () => {
          const database = 'datasource-sql-connect-with-uri-test';
          await setupDatabaseWithTypes(connectionDetails, database, schema);

          const sequelize = await buildSequelizeInstance(
            `${connectionDetails.url(database)}?${queryString}`,
            logger,
          );

          await sequelize.close();
          expect(sequelize).toBeInstanceOf(Sequelize);
        });

        it('using uri in options', async () => {
          const database = 'datasource-sql-connect-with-uri-in-options-test';
          await setupDatabaseWithTypes(connectionDetails, database, schema);

          const sequelize = await buildSequelizeInstance(
            { uri: connectionDetails.url(database), schema },
            logger,
          );

          await sequelize.close();
          expect(sequelize).toBeInstanceOf(Sequelize);
        });

        it('using options', async () => {
          const database = 'datasource-sql-connect-with-options-test';
          await setupDatabaseWithTypes(connectionDetails, database, schema);

          const sequelize = await buildSequelizeInstance(
            { ...connectionDetails.options(database), schema },
            logger,
          );

          await sequelize.close();
          expect(sequelize).toBeInstanceOf(Sequelize);
        });
      });

      describe('with tables', () => {
        let sequelize: Sequelize | undefined;
        let thingModel: ModelStatic<Model<{ id: number; name: string }, { name?: string }>>;

        beforeEach(async () => {
          const databaseName = 'datasource-sql-tables-test';
          const logger = jest.fn();

          await setupSimpleTable(connectionDetails, databaseName, schema);

          sequelize = await buildSequelizeInstance(
            `${connectionDetails.url(databaseName)}?${queryString}`,
            logger,
          );

          thingModel = sequelize.models.thing;
        });

        afterEach(async () => {
          await sequelize?.close();
          sequelize = undefined;
        });

        it('should allow to insert records', async () => {
          const inserted = await thingModel.create(
            {
              name: 'test',
            },
            {
              returning: true,
            },
          );

          expect(inserted).toEqual(
            expect.objectContaining({
              id: expect.any(Number),
              name: 'test',
            }),
          );
        });

        it('should allow to select records', async () => {
          const created = await thingModel.create(
            {
              name: 'test',
            },
            {
              returning: true,
              raw: true,
            },
          );

          const group = await thingModel.findByPk(created.get('id') as number);

          expect(group).toEqual(expect.objectContaining({ id: created.get('id'), name: 'test' }));
        });
      });

      describe('with simple primitive fields', () => {
        it('should generate a sql datasource with default values', async () => {
          const databaseName = 'datasource-sql-primitive-field-test';
          const logger = jest.fn();

          const setupSequelize = await setupDatabaseWithTypes(
            connectionDetails,
            databaseName,
            schema,
          );
          const setupModels = setupSequelize.models;
          const attributesMapping = getAttributeMapping(connectionDetails.dialect as Dialect);

          const sequelize = await buildSequelizeInstance(
            `${connectionDetails.url(databaseName)}?${queryString}`,
            logger,
          );

          try {
            const dataSourceModels = sequelize.models;

            expect(Object.keys(dataSourceModels)).toEqual(
              expect.arrayContaining(Object.keys(setupModels)),
            );

            Object.values(setupModels).forEach(setupModel => {
              const model = dataSourceModels[setupModel.name];

              expect(model).toBeDefined();

              Object.entries(model.getAttributes()).forEach(([fieldName, attributeDefinition]) => {
                expect({ [fieldName]: attributeDefinition }).toStrictEqual({
                  [fieldName]: expect.objectContaining(attributesMapping[model.name][fieldName]),
                });
              });
            });
          } finally {
            await sequelize.close();
          }
        });

        if (connectionDetails.supports.arrays) {
          describe('with array types', () => {
            describe.each([DataTypes.TEXT, DataTypes.STRING(255), DataTypes.STRING])(
              `with %s`,
              type => {
                let sequelize;

                beforeEach(async () => {
                  const setupSequelize = await setupEmptyDatabase(
                    connectionDetails,
                    'datasource-sql-array-test',
                  );

                  try {
                    await setupSequelize?.getQueryInterface().createTable('things', {
                      id: {
                        type: DataTypes.INTEGER,
                        primaryKey: true,
                        autoIncrement: true,
                      },
                      tags: {
                        type: DataTypes.ARRAY(type),
                      },
                    });
                  } finally {
                    await setupSequelize?.close();
                  }

                  try {
                    sequelize = await buildSequelizeInstance(
                      `${connectionDetails.url('datasource-sql-array-test')}`,
                      jest.fn(),
                    );
                  } catch (e) {
                    console.error('error', e);
                    throw e;
                  }
                });

                afterEach(async () => {
                  await sequelize?.close();
                });

                it('should correctly create records', async () => {
                  expect.assertions(0);

                  // It should not throw
                  await sequelize.models.things.create({ tags: ['tag1', 'tag2'] });
                });

                it('should correctly find records with some values in the array', async () => {
                  await sequelize.models.things.create({ tags: ['tag1', 'tag2'] });

                  let things;

                  try {
                    things = await sequelize.models.things.findAll({
                      where: {
                        tags: {
                          [Op.contains]: ['tag1'],
                        },
                      },
                    });
                  } catch (e) {
                    console.error(e);
                    throw e;
                  }

                  expect(things).toHaveLength(1);
                });
              },
            );

            describe.each([
              DataTypes.INTEGER,
              DataTypes.BIGINT,
              DataTypes.REAL,
              DataTypes.FLOAT,
              DataTypes.DECIMAL(10, 2),
            ])(`with %s`, type => {
              let sequelize;

              beforeEach(async () => {
                const setupSequelize = await setupEmptyDatabase(
                  connectionDetails,
                  'datasource-sql-array-test',
                );

                try {
                  await setupSequelize?.getQueryInterface().createTable('things', {
                    id: {
                      type: DataTypes.INTEGER,
                      primaryKey: true,
                      autoIncrement: true,
                    },
                    values: {
                      type: DataTypes.ARRAY(type),
                    },
                  });
                } catch (e) {
                  console.error(e);
                  throw e;
                } finally {
                  await setupSequelize?.close();
                }

                sequelize = await buildSequelizeInstance(
                  `${connectionDetails.url('datasource-sql-array-test')}`,
                  jest.fn(),
                );
              });

              afterEach(async () => {
                await sequelize?.close();
              });

              it('should correctly create records', async () => {
                expect.assertions(0);

                // It should not throw
                await sequelize.models.things.create({ values: [1, 2] });
              });

              it('should correctly find records with some values in the array', async () => {
                await sequelize.models.things.create({ values: [1, 2] });
                await sequelize.models.things.create({ values: [2] });

                let things;

                try {
                  things = await sequelize.models.things.findAll({
                    where: {
                      values: {
                        [Op.contains]: [1],
                      },
                    },
                  });
                } catch (e) {
                  console.error(e);
                  throw e;
                }

                expect(things).toHaveLength(1);
              });
            });

            if (connectionDetails.supports.enums) {
              describe('with arrays of enums', () => {
                let sequelize;

                beforeEach(async () => {
                  const setupSequelize = await setupEmptyDatabase(
                    connectionDetails,
                    'datasource-sql-array-test',
                  );

                  try {
                    await setupSequelize?.getQueryInterface().createTable('things', {
                      id: {
                        type: DataTypes.INTEGER,
                        primaryKey: true,
                        autoIncrement: true,
                      },
                      values: {
                        type: DataTypes.ARRAY(DataTypes.ENUM('foo', 'bar', 'baz')),
                      },
                    });
                  } finally {
                    await setupSequelize?.close();
                  }

                  sequelize = await buildSequelizeInstance(
                    `${connectionDetails.url('datasource-sql-array-test')}`,
                    jest.fn(),
                  );
                });

                afterEach(async () => {
                  await sequelize?.close();
                });

                it('should correctly create records', async () => {
                  expect.assertions(0);
                  await sequelize.models.things.create({ values: ['foo', 'bar'] });
                });

                it('should correctly find records with some values in the array', async () => {
                  await sequelize.models.things.create({ values: ['foo', 'bar'] });
                  await sequelize.models.things.create({ values: ['bar'] });

                  let things;

                  try {
                    things = await sequelize.models.things.findAll({
                      where: {
                        values: {
                          [Op.contains]: ['foo'],
                        },
                      },
                    });
                  } catch (e) {
                    console.error(e);
                    throw e;
                  }

                  expect(things).toHaveLength(1);
                });
              });
            }
          });
        }
      });

      describe('with relations', () => {
        let setupSequelize: Sequelize;
        let modelSequelize: Sequelize;

        beforeEach(async () => {
          const databaseName = 'datasource-sql-relation-test';

          setupSequelize = await setupDatabaseWithRelations(
            connectionDetails,
            databaseName,
            schema,
          );
          await setupSequelize.close();

          const logger = jest.fn();

          modelSequelize = await buildSequelizeInstance(
            `${connectionDetails.url(databaseName)}${queryString && `?${queryString}`}`,
            logger,
          );
        });

        afterEach(async () => {
          await modelSequelize?.close();
        });

        it(`should generate a sql datasource with relation`, async () => {
          const dataSourceModels = modelSequelize.models;

          const modelAssociations = extractTablesAndRelations(dataSourceModels);

          expect(modelAssociations).toMatchObject(RELATION_MAPPING);
        });
      });

      describe('with soft deleted record', () => {
        const databaseName = 'datasource-sql-softdeleted-test';

        describe('when display soft deleted only on one table', () => {
          it('should only display records of that table', async () => {
            const logger = jest.fn();
            await setupSoftDeleted(connectionDetails, databaseName, schema);

            const sqlDs = await createSqlDataSource(
              `${connectionDetails.url(databaseName)}?${queryString}`,
              { displaySoftDeleted: ['softDeleted'] },
            )(logger, jest.fn());

            const collection = sqlDs.getCollection('softDeleted');
            const collection2 = sqlDs.getCollection('softDeleted2');

            await collection.create(caller.build(), [
              { name: 'shouldDisplay', deletedAt: Date.now() },
            ]);
            await collection2.create(caller.build(), [
              { name: 'shouldNotDisplay', deletedAt: Date.now() },
            ]);

            const records = await collection.list(
              caller.build(),
              filter.build(),
              new Projection('name', 'deletedAt'),
            );
            const records2 = await collection2.list(
              caller.build(),
              filter.build(),
              new Projection('name', 'deletedAt'),
            );

            await (sqlDs as SequelizeDataSource).close();

            expect(records).toHaveLength(1);
            expect(records2).toHaveLength(0);
          });
        });

        describe('when display soft deleted for all tables', () => {
          it('should display records on all tables', async () => {
            const logger = jest.fn();
            await setupSoftDeleted(connectionDetails, databaseName, schema);

            const sqlDs = await createSqlDataSource(
              `${connectionDetails.url(databaseName)}?${queryString}`,
              { displaySoftDeleted: true },
            )(logger, jest.fn());

            const collection = sqlDs.getCollection('softDeleted');
            const collection2 = sqlDs.getCollection('softDeleted2');

            await collection.create(caller.build(), [
              { name: 'shouldDisplay', deletedAt: Date.now() },
            ]);
            await collection2.create(caller.build(), [
              { name: 'shouldNotDisplay', deletedAt: Date.now() },
            ]);

            const records = await collection.list(
              caller.build(),
              filter.build(),
              new Projection('name', 'deletedAt'),
            );
            const records2 = await collection2.list(
              caller.build(),
              filter.build(),
              new Projection('name', 'deletedAt'),
            );

            await (sqlDs as SequelizeDataSource).close();

            expect(records).toHaveLength(1);
            expect(records2).toHaveLength(1);
          });
        });
      });
    });
  });

  describe.each(CONNECTION_DETAILS)('on $name database', connectionDetails => {
    describe('when the table has an "id" without primary key constraint', () => {
      it('the model should assume id is the pk', async () => {
        const databaseName = 'datasource-sql-id-field-test';
        const logger = jest.fn();

        await setupDatabaseWithIdNotPrimary(connectionDetails, databaseName);

        const sequelize = await buildSequelizeInstance(connectionDetails.url(databaseName), logger);

        // We should have zero collections and a warning on the console
        expect(sequelize).toBeInstanceOf(Sequelize);
        expect(sequelize.models.person.getAttributes().id.primaryKey).toBe(true);

        await sequelize.close();
      });
    });

    describe('introspect database before injecting the tables to the builder', () => {
      it('should build the sequelize instance without introspected the db again', async () => {
        const databaseName = 'datasource-sql-primitive-field-test';
        const logger = jest.fn();

        const setupSequelize = await setupDatabaseWithTypes(
          connectionDetails,
          databaseName,
          undefined,
        );
        const setupModels = setupSequelize.models;
        const attributesMapping = getAttributeMapping(connectionDetails.dialect);

        const introspection = await introspect(connectionDetails.url(databaseName), logger);
        jest.spyOn(Introspector, 'introspect').mockResolvedValue({
          tables: [],
          views: [],
          version: 3,
          source: '@forestadmin/datasource-sql',
        });
        const sequelize = await buildSequelizeInstance(
          connectionDetails.url(databaseName),
          logger,
          introspection,
        );

        expect(Introspector.introspect).not.toHaveBeenCalled();

        const dataSourceModels = sequelize.models;

        Object.values(setupModels).forEach(setupModel => {
          const model = dataSourceModels[setupModel.name];
          expect(model).toBeDefined();
          Object.entries(model.getAttributes()).forEach(([fieldName, attributeDefinition]) => {
            expect({ [fieldName]: attributeDefinition }).toStrictEqual({
              [fieldName]: expect.objectContaining(attributesMapping[model.name][fieldName]),
            });
          });
        });

        await sequelize.close();
      });
    });

    if (connectionDetails.supports.schemas) {
      describe('When tables are present in multiple schemas', () => {
        const SCHEMA = 'test_schema_1';
        let sequelize: Sequelize | undefined;

        async function setupDatabaseOnSchema(
          localSequelize: Sequelize,
          {
            schema,
            createRelationships,
          }: {
            schema: string | undefined;
            createRelationships: boolean;
          },
        ) {
          const persons = localSequelize.define(
            `person-${schema ? 'with-schema' : 'without-schema'}`,
            {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
              },
              name: {
                type: DataTypes.STRING,
              },
            },
            {
              schema,
              tableName: 'person',
            },
          );

          const cars = localSequelize.define(
            `car-${schema ? 'with-schema' : 'without-schema'}`,
            {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
              },
              name: {
                type: DataTypes.STRING,
              },
            },
            {
              schema,
              tableName: 'car',
            },
          );

          if (createRelationships) {
            persons.hasMany(cars);
            cars.belongsTo(persons);
          }
        }

        async function setupDB(databaseName: string) {
          if (connectionDetails.supports.multipleDatabases) {
            const localSequelize = new Sequelize({
              ...connectionDetails.options(),
              logging: false,
            });

            try {
              await localSequelize.getQueryInterface().dropDatabase(databaseName);
              await localSequelize.getQueryInterface().createDatabase(databaseName);
            } finally {
              await localSequelize.close();
            }
          }

          const dbSequelize = new Sequelize({
            ...connectionDetails.options(databaseName),
            logging: false,
          });

          await dbSequelize.getQueryInterface().createSchema(SCHEMA);

          return dbSequelize;
        }

        afterEach(async () => {
          await sequelize?.close();
          sequelize = undefined;
        });

        it('should only return tables from the given schema', async () => {
          const DATABASE = 'datasource-sql-introspect-two-schemas-relationships-test';
          sequelize = await setupDB(DATABASE);

          await setupDatabaseOnSchema(sequelize, {
            schema: undefined,
            createRelationships: false,
          });
          await setupDatabaseOnSchema(sequelize, { schema: SCHEMA, createRelationships: true });

          await sequelize.sync({ force: false });

          const logger = jest.fn();
          sequelize = await buildSequelizeInstance(
            `${connectionDetails.url(DATABASE)}?schema=${SCHEMA}`,
            logger,
          );

          const tablesAndRelations = extractTablesAndRelations(sequelize.models);

          expect(tablesAndRelations).toMatchObject(
            expect.objectContaining({
              person: {
                cars: 'HasMany',
              },
              car: {
                personWithSchema: 'BelongsTo',
              },
            }),
          );
        });

        it('should only return relationships from the given schema', async () => {
          const DATABASE = 'datasource-sql-introspect-two-schemas-without-relationships-test';
          sequelize = await setupDB(DATABASE);

          await setupDatabaseOnSchema(sequelize, {
            schema: undefined,
            createRelationships: true,
          });
          await setupDatabaseOnSchema(sequelize, {
            schema: SCHEMA,
            createRelationships: false,
          });

          await sequelize.sync({ force: false });
          const logger = jest.fn();

          sequelize = await buildSequelizeInstance(
            `${connectionDetails.url(DATABASE)}?schema=${SCHEMA}`,
            logger,
          );

          const tablesAndRelations = extractTablesAndRelations(sequelize.models);

          expect(tablesAndRelations).toMatchObject(
            expect.objectContaining({
              person: expect.not.objectContaining({
                cars: 'HasMany',
              }),
              car: expect.not.objectContaining({
                personWithoutSchema: 'BelongsTo',
              }),
            }),
          );
        });

        it('should only return tables from the default schema', async () => {
          const DATABASE = 'datasource-sql-introspect-2-schemas-relationships-test';
          sequelize = await setupDB(DATABASE);

          await setupDatabaseOnSchema(sequelize, {
            schema: undefined,
            createRelationships: true,
          });
          await setupDatabaseOnSchema(sequelize, {
            schema: SCHEMA,
            createRelationships: false,
          });

          await sequelize.sync({ force: false });

          const logger = jest.fn();
          sequelize = await buildSequelizeInstance(connectionDetails.url(DATABASE), logger);

          const tablesAndRelations = extractTablesAndRelations(sequelize.models);

          expect(tablesAndRelations).toMatchObject(
            expect.objectContaining({
              person: {
                cars: 'HasMany',
              },
              car: {
                personWithoutSchema: 'BelongsTo',
              },
            }),
          );
        });

        it('should only return relationships from the default schema', async () => {
          const DATABASE =
            'datasource-sql-introspect-two-schemas-without-relationships-default-test';
          sequelize = await setupDB(DATABASE);

          await setupDatabaseOnSchema(sequelize, {
            schema: undefined,
            createRelationships: false,
          });
          await setupDatabaseOnSchema(sequelize, { schema: SCHEMA, createRelationships: true });

          await sequelize.sync({ force: false });
          const logger = jest.fn();

          sequelize = await buildSequelizeInstance(`${connectionDetails.url(DATABASE)}`, logger);

          const tablesAndRelations = extractTablesAndRelations(sequelize.models);

          expect(tablesAndRelations).toMatchObject(
            expect.objectContaining({
              person: expect.not.objectContaining({
                cars: 'HasMany',
              }),
              car: expect.not.objectContaining({
                personWithSchema: 'BelongsTo',
              }),
            }),
          );
        });
      });
    }

    if (connectionDetails.supports.uuid) {
      describe('with an UUID primary key', () => {
        const dbName = 'datasource-sql-uuid-primary-key-test';
        let setupSequelize: Sequelize;

        beforeEach(async () => {
          setupSequelize = await setupEmptyDatabase(connectionDetails, dbName);
        });

        afterEach(async () => {
          await setupSequelize?.close();
        });

        it('should correctly create records and return their id', async () => {
          const logger = jest.fn();

          try {
            if (connectionDetails.setupUUID) await connectionDetails.setupUUID(setupSequelize);

            await setupSequelize.getQueryInterface().createTable('things', {
              id: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: setupSequelize.literal(
                  connectionDetails.uuidFunctionLiteral as string,
                ),
              },
              name: {
                type: DataTypes.STRING,
              },
            });
          } catch (e) {
            console.error('Error', e);
            throw e;
          }

          const sequelize = await buildSequelizeInstance(connectionDetails.url(dbName), logger);

          try {
            const thing = (await sequelize.models.things.create({
              name: 'test',
            })) as unknown as { id: string };

            expect(thing.id).toMatch(/[0-9a-f-]{36}/i);
          } finally {
            await sequelize.close();
          }
        });
      });
    }
  });
});
