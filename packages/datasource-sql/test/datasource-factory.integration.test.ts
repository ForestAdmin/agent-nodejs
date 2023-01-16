import { Dialect, Sequelize } from 'sequelize';

import setupDatabaseWithIdNotPrimary from './_helpers/setup-id-is-not-a-pk';
import setupDatabaseWithTypes, { getAttributeMapping } from './_helpers/setup-using-all-types';
import setupDatabaseWithRelations, { RELATION_MAPPING } from './_helpers/setup-using-relations';
import { buildSequelizeInstance, introspect } from '../src';
import Introspector from '../src/introspection/introspector';

describe('SqlDataSourceFactory > Integration', () => {
  describe('when the table has an "id" without primary key constraint', () => {
    it('the model should be skipped and not throw error', async () => {
      const databaseName = 'datasource-sql-id-field-test';
      const dialect = 'postgres';
      const host = 'test:password@localhost:5443';
      const logger = jest.fn();

      await setupDatabaseWithIdNotPrimary(dialect, host, databaseName);

      const sequelize = await buildSequelizeInstance(
        `${dialect}://${host}/${databaseName}`,
        logger,
      );

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
    ['postgres', 'test:password@localhost:5443'],
    ['mysql', 'root:password@localhost:3307'],
    ['mssql', 'sa:yourStrong(!)Password@localhost:1434'],
    ['mariadb', 'root:password@localhost:3809'],
  ])('on "%s" database', (dialect, host) => {
    describe('with simple primitive fields', () => {
      it('should generate a sql datasource with default values', async () => {
        const databaseName = 'datasource-sql-primitive-field-test';
        const uri = `${dialect}://${host}/${databaseName}`;
        const logger = jest.fn();

        const setupSequelize = await setupDatabaseWithTypes(dialect, host, databaseName);
        const setupModels = setupSequelize.models;
        const attributesMapping = getAttributeMapping(dialect as Dialect);

        const sequelize = await buildSequelizeInstance(uri, logger);
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

        sequelize.close();
      });
    });

    describe('with relations', () => {
      it('should generate a sql datasource with relation', async () => {
        const databaseName = 'datasource-sql-relation-test';
        const uri = `${dialect}://${host}/${databaseName}`;
        const logger = jest.fn();

        const setupSequelize = await setupDatabaseWithRelations(dialect, host, databaseName);
        const setupModels = setupSequelize.models;

        const sequelize = await buildSequelizeInstance(uri, logger);
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

        sequelize.close();
      });
    });
  });

  describe('introspect database before injected the tables to the builder', () => {
    it('should build the sequelize instance without introspected the db again', async () => {
      const databaseName = 'datasource-sql-primitive-field-test';
      const dialect = 'postgres';
      const host = 'test:password@localhost:5443';
      const uri = `${dialect}://${host}/${databaseName}`;
      const logger = jest.fn();

      const setupSequelize = await setupDatabaseWithTypes(dialect, host, databaseName);
      const setupModels = setupSequelize.models;
      const attributesMapping = getAttributeMapping(dialect as Dialect);

      const tables = await introspect(uri, logger);
      Introspector.introspect = jest.fn();
      const sequelize = await buildSequelizeInstance(uri, logger, tables);

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

      sequelize.close();
    });
  });
});
