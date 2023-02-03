import { Dialect, Sequelize } from 'sequelize';

import setupDatabaseWithIdNotPrimary from './_helpers/setup-id-is-not-a-pk';
import setupDatabaseWithTypes, { getAttributeMapping } from './_helpers/setup-using-all-types';
import setupDatabaseWithRelations, { RELATION_MAPPING } from './_helpers/setup-using-relations';
import { buildSequelizeInstance, introspect } from '../src';
import Introspector from '../src/introspection/introspector';

describe('SqlDataSourceFactory > Integration', () => {
  describe('catch all the sequelize connection errors during the introspect', () => {
    const databaseName = 'datasource-sql-primitive-field-test';
    const dialect = 'postgres';
    const logger = jest.fn();

    describe('when the credentials are wrong', () => {
      it('should throw an error', async () => {
        const host = 'test:badPassword@localhost:5443';
        const uri = `${dialect}://${host}/${databaseName}`;

        await expect(() => introspect(uri, logger)).rejects.toThrow(
          'Connection error: password authentication failed for user "test"',
        );
      });
    });

    describe('when the port is wrong', () => {
      it('should throw an error', async () => {
        const host = 'test:password@localhost:544';
        const uri = `${dialect}://${host}/${databaseName}`;

        await expect(() => introspect(uri, logger)).rejects.toThrow(
          'Connection refused error: connect ECONNREFUSED 127.0.0.1:544',
        );
      });
    });

    describe('when the database name is wrong', () => {
      it('should throw an error', async () => {
        const host = 'test:password@localhost:5443';
        const uri = `${dialect}://${host}/aBadDatabaseName`;

        await expect(() => introspect(uri, logger)).rejects.toThrow(
          'Connection error: database "aBadDatabaseName" does not exist',
        );
      });
    });

    describe('when the user does not exist', () => {
      it('should throw an error', async () => {
        const host = 'userDoesNotExist:password@localhost:5443';
        const uri = `${dialect}://${host}/${databaseName}`;

        await expect(() => introspect(uri, logger)).rejects.toThrow(
          'Connection error: password authentication failed for user "userDoesNotExist"',
        );
      });
    });
  });

  describe('when the table has an "id" without primary key constraint', () => {
    it('the model should be skipped and not throw error', async () => {
      const baseUri = 'postgres://test:password@localhost:5443';
      const databaseName = 'datasource-sql-id-field-test';
      const logger = jest.fn();

      await setupDatabaseWithIdNotPrimary(baseUri, databaseName);

      const sequelize = await buildSequelizeInstance(`${baseUri}/${databaseName}`, logger);

      // We should have zero collections and a warning on the console
      expect(sequelize).toBeInstanceOf(Sequelize);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining('Skipping table "person"'),
      );

      await sequelize.close();
    });
  });

  describe.each([
    ['postgres' as Dialect, 'test', 'password', 'localhost', 5443],
    ['mysql' as Dialect, 'root', 'password', 'localhost', 3307],
    ['mssql' as Dialect, 'sa', 'yourStrong(!)Password', 'localhost', 1434],
    ['mariadb' as Dialect, 'root', 'password', 'localhost', 3809],
  ])('on "%s" database', (dialect, username, password, host, port) => {
    const baseUri = `${dialect}://${username}:${password}@${host}:${port}`;

    describe('Connecting with different options', () => {
      const logger = jest.fn();

      it('using uri', async () => {
        const database = 'datasource-sql-connect-with-uri-test';
        await setupDatabaseWithTypes(baseUri, dialect, database);

        const sequelize = await buildSequelizeInstance(`${baseUri}/${database}`, logger);

        sequelize.close();
        expect(sequelize).toBeInstanceOf(Sequelize);
      });

      it('using uri in options', async () => {
        const database = 'datasource-sql-connect-with-uri-in-options-test';
        await setupDatabaseWithTypes(baseUri, dialect, database);

        const sequelize = await buildSequelizeInstance({ uri: `${baseUri}/${database}` }, logger);

        sequelize.close();
        expect(sequelize).toBeInstanceOf(Sequelize);
      });

      it('using options', async () => {
        const database = 'datasource-sql-connect-with-options-test';
        await setupDatabaseWithTypes(baseUri, dialect, database);

        const sequelize = await buildSequelizeInstance(
          { dialect, username, password, port, host, database },
          logger,
        );

        sequelize.close();
        expect(sequelize).toBeInstanceOf(Sequelize);
      });
    });

    describe('with simple primitive fields', () => {
      it('should generate a sql datasource with default values', async () => {
        const databaseName = 'datasource-sql-primitive-field-test';
        const logger = jest.fn();

        const setupSequelize = await setupDatabaseWithTypes(baseUri, dialect, databaseName);
        const setupModels = setupSequelize.models;
        const attributesMapping = getAttributeMapping(dialect as Dialect);

        const sequelize = await buildSequelizeInstance(`${baseUri}/${databaseName}`, logger);
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
      it('should generate a sql datasource with relation', async () => {
        const databaseName = 'datasource-sql-relation-test';
        const logger = jest.fn();

        const setupSequelize = await setupDatabaseWithRelations(baseUri, databaseName);
        const setupModels = setupSequelize.models;

        const sequelize = await buildSequelizeInstance(`${baseUri}/${databaseName}`, logger);
        const dataSourceModels = sequelize.models;

        Object.values(setupModels).forEach(setupModel => {
          const model = dataSourceModels[setupModel.name];
          const relationMapping = RELATION_MAPPING[model.name];

          expect(model).toBeDefined();
          Object.entries(model.associations).forEach(([associationName, association]) => {
            expect({ [associationName]: association }).toStrictEqual({
              [associationName]: expect.objectContaining(relationMapping[associationName]),
            });
          });
        });

        const belongsToManyModel = dataSourceModels.productOrder;
        const relationMapping = RELATION_MAPPING.productOrder;
        expect(belongsToManyModel).toBeDefined();
        Object.entries(belongsToManyModel.associations).forEach(
          ([associationName, association]) => {
            expect({ [associationName]: association }).toStrictEqual({
              [associationName]: expect.objectContaining(relationMapping[associationName]),
            });
          },
        );

        await sequelize.close();
      });
    });
  });

  describe('introspect database before injected the tables to the builder', () => {
    it('should build the sequelize instance without introspected the db again', async () => {
      const dialect = 'postgres';
      const baseUri = 'postgres://test:password@localhost:5443';
      const databaseName = 'datasource-sql-primitive-field-test';
      const logger = jest.fn();

      const setupSequelize = await setupDatabaseWithTypes(baseUri, dialect, databaseName);
      const setupModels = setupSequelize.models;
      const attributesMapping = getAttributeMapping(dialect);

      const tables = await introspect(`${baseUri}/${databaseName}`, logger);
      Introspector.introspect = jest.fn();
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
});
