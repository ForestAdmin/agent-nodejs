import { stringify } from 'querystring';
import { DataTypes, Dialect, Sequelize } from 'sequelize';

import CONNECTION_DETAILS from './_helpers/connection-details';
import setupDatabaseWithIdNotPrimary from './_helpers/setup-id-is-not-a-pk';
import setupDatabaseWithTypes, { getAttributeMapping } from './_helpers/setup-using-all-types';
import setupDatabaseWithRelations, { RELATION_MAPPING } from './_helpers/setup-using-relations';
import { buildSequelizeInstance, introspect } from '../src';
import Introspector from '../src/introspection/introspector';

function extractTablesAndRelations(
  models: Sequelize['models'],
): Record<string, Record<string, string>> {
  return Object.entries(models).reduce(
    (models, [name, model]) => ({
      ...models,
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

  describe('when the table has an "id" without primary key constraint', () => {
    it('the model should assume id is the pk', async () => {
      const baseUri = 'postgres://test:password@localhost:5443';
      const databaseName = 'datasource-sql-id-field-test';
      const logger = jest.fn();

      await setupDatabaseWithIdNotPrimary(baseUri, databaseName);

      const sequelize = await buildSequelizeInstance(`${baseUri}/${databaseName}`, logger);

      // We should have zero collections and a warning on the console
      expect(sequelize).toBeInstanceOf(Sequelize);
      expect(sequelize.models.person.getAttributes().id.primaryKey).toBe(true);

      await sequelize.close();
    });
  });

  describe.each(
    CONNECTION_DETAILS.filter(d => d.dialect === 'mariadb').flatMap(connectionDetails => [
      [
        connectionDetails.dialect,
        connectionDetails.username,
        connectionDetails.password,
        connectionDetails.host,
        connectionDetails.port,
        undefined,
      ],
      ...(connectionDetails.supports.schemas
        ? [
            [
              connectionDetails.dialect,
              connectionDetails.username,
              connectionDetails.password,
              connectionDetails.host,
              connectionDetails.port,
              'test_schema',
            ],
          ]
        : []),
    ]) as [Dialect, string, string, string, number, string | undefined][],
  )('on "%s" database', (dialect, username, password, host, port, schema) => {
    const queryParams = schema ? { schema } : {};
    const queryString = stringify(queryParams);
    const baseUri = `${dialect}://${username}:${password}@${host}:${port}`;

    describe(`when schema is ${schema}`, () => {
      describe('Connecting with different options', () => {
        const logger = jest.fn();

        it('using uri', async () => {
          const database = 'datasource-sql-connect-with-uri-test';
          await setupDatabaseWithTypes(baseUri, dialect, database, schema);

          const sequelize = await buildSequelizeInstance(
            `${baseUri}/${database}?${queryString}`,
            logger,
          );

          await sequelize.close();
          expect(sequelize).toBeInstanceOf(Sequelize);
        });

        it('using uri in options', async () => {
          const database = 'datasource-sql-connect-with-uri-in-options-test';
          await setupDatabaseWithTypes(baseUri, dialect, database, schema);

          const sequelize = await buildSequelizeInstance(
            { uri: `${baseUri}/${database}?${queryString}` },
            logger,
          );

          await sequelize.close();
          expect(sequelize).toBeInstanceOf(Sequelize);
        });

        it('using options', async () => {
          const database = 'datasource-sql-connect-with-options-test';
          await setupDatabaseWithTypes(baseUri, dialect, database, schema);

          const sequelize = await buildSequelizeInstance(
            { dialect, username, password, port, host, database, schema },
            logger,
          );

          await sequelize.close();
          expect(sequelize).toBeInstanceOf(Sequelize);
        });
      });

      describe('with simple primitive fields', () => {
        it('should generate a sql datasource with default values', async () => {
          const databaseName = 'datasource-sql-primitive-field-test';
          const logger = jest.fn();

          const setupSequelize = await setupDatabaseWithTypes(
            baseUri,
            dialect,
            databaseName,
            schema,
          );
          const setupModels = setupSequelize.models;
          const attributesMapping = getAttributeMapping(dialect as Dialect);

          const sequelize = await buildSequelizeInstance(
            `${baseUri}/${databaseName}?${queryString}`,
            logger,
          );
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

      describe('with relations', () => {
        let setupSequelize: Sequelize;
        let modelSequelize: Sequelize;

        beforeEach(async () => {
          const databaseName = 'datasource-sql-relation-test';

          setupSequelize = await setupDatabaseWithRelations(baseUri, databaseName, schema);
          await setupSequelize.close();

          const logger = jest.fn();

          modelSequelize = await buildSequelizeInstance(
            `${baseUri}/${databaseName}${queryString && `?${queryString}`}`,
            logger,
          );
        });

        afterEach(async () => {
          await modelSequelize.close();
        });

        it(`should generate a sql datasource with relation`, async () => {
          const dataSourceModels = modelSequelize.models;

          const modelAssociations = extractTablesAndRelations(dataSourceModels);

          expect(modelAssociations).toMatchObject(RELATION_MAPPING);
        });
      });
    });
  });

  describe('introspect database before injecting the tables to the builder', () => {
    it('should build the sequelize instance without introspected the db again', async () => {
      const dialect = 'postgres';
      const baseUri = 'postgres://test:password@localhost:5443';
      const databaseName = 'datasource-sql-primitive-field-test';
      const logger = jest.fn();

      const setupSequelize = await setupDatabaseWithTypes(
        baseUri,
        dialect,
        databaseName,
        undefined,
      );
      const setupModels = setupSequelize.models;
      const attributesMapping = getAttributeMapping(dialect);

      const tables = await introspect(`${baseUri}/${databaseName}`, logger);
      jest.spyOn(Introspector, 'introspect').mockResolvedValue([]);
      const sequelize = await buildSequelizeInstance(`${baseUri}/${databaseName}`, logger, tables);

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

  describe('When tables are present in multiple schemas', () => {
    describe.each(CONNECTION_DETAILS.filter(c => c.supports.schemas))('On $dialect', connection => {
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
        const localSequelize = new Sequelize({
          dialect: connection.dialect,
          username: connection.username,
          password: connection.password,
          port: connection.port,
          logging: false,
        });

        try {
          await localSequelize.getQueryInterface().dropDatabase(databaseName);
          await localSequelize.getQueryInterface().createDatabase(databaseName);
        } finally {
          await localSequelize.close();
        }

        const dbSequelize = new Sequelize({
          dialect: connection.dialect,
          username: connection.username,
          password: connection.password,
          port: connection.port,
          database: databaseName,
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

        await setupDatabaseOnSchema(sequelize, { schema: undefined, createRelationships: false });
        await setupDatabaseOnSchema(sequelize, { schema: SCHEMA, createRelationships: true });

        await sequelize.sync({ force: false });

        const logger = jest.fn();
        sequelize = await buildSequelizeInstance(
          `${connection.dialect}://${connection.username}:${connection.password}@${connection.host}:${connection.port}/${DATABASE}?schema=${SCHEMA}`,
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

        await setupDatabaseOnSchema(sequelize, { schema: undefined, createRelationships: true });
        await setupDatabaseOnSchema(sequelize, { schema: SCHEMA, createRelationships: false });

        await sequelize.sync({ force: false });
        const logger = jest.fn();

        sequelize = await buildSequelizeInstance(
          `${connection.dialect}://${connection.username}:${connection.password}@${connection.host}:${connection.port}/${DATABASE}?schema=${SCHEMA}`,
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
        const DATABASE = 'datasource-sql-introspect-two-schemas-relationships-default-test';
        sequelize = await setupDB(DATABASE);

        await setupDatabaseOnSchema(sequelize, { schema: undefined, createRelationships: true });
        await setupDatabaseOnSchema(sequelize, { schema: SCHEMA, createRelationships: false });

        await sequelize.sync({ force: false });

        const logger = jest.fn();
        sequelize = await buildSequelizeInstance(
          `${connection.dialect}://${connection.username}:${connection.password}@${connection.host}:${connection.port}/${DATABASE}`,
          logger,
        );

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
        const DATABASE = 'datasource-sql-introspect-two-schemas-without-relationships-default-test';
        sequelize = await setupDB(DATABASE);

        await setupDatabaseOnSchema(sequelize, { schema: undefined, createRelationships: false });
        await setupDatabaseOnSchema(sequelize, { schema: SCHEMA, createRelationships: true });

        await sequelize.sync({ force: false });
        const logger = jest.fn();

        sequelize = await buildSequelizeInstance(
          `${connection.dialect}://${connection.username}:${connection.password}@${connection.host}:${connection.port}/${DATABASE}`,
          logger,
        );

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
  });
});
