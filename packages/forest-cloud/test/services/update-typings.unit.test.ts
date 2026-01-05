import type BootstrapPathManager from '../../src/services/bootstrap-path-manager';
import type DistPathManager from '../../src/services/dist-path-manager';
import type { Agent } from '@forestadmin/agent';
import type { Introspection as DataSourceMongoIntrospection } from '@forestadmin/datasource-mongo';
import type { SupportedIntrospection as DataSourceSQLIntrospection } from '@forestadmin/datasource-sql';
import type { DataSourceFactory } from '@forestadmin/datasource-toolkit';
import type { Mongoose } from 'mongoose';
import type { Sequelize } from 'sequelize';

import { createAgent } from '@forestadmin/agent';
import { buildDisconnectedMongooseInstance } from '@forestadmin/datasource-mongo';
import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { buildDisconnectedSequelizeInstance } from '@forestadmin/datasource-sql';
import { BusinessError, IntrospectionFormatError } from '@forestadmin/datasource-toolkit';
import path from 'path';

import { throwIfNoBuiltCode } from '../../src/services/access-file';
import loadCustomization from '../../src/services/load-customization';
import { updateTypings, updateTypingsWithCustomizations } from '../../src/services/update-typings';

jest.mock('@forestadmin/agent');
jest.mock('@forestadmin/datasource-sql');
jest.mock('@forestadmin/datasource-sequelize');
jest.mock('@forestadmin/datasource-mongo');
jest.mock('@forestadmin/datasource-mongoose');
jest.mock('path');
jest.mock('../../src/services/access-file');
jest.mock('../../src/services/load-customization');

describe('update-typings', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  function setupMocks() {
    const agent = {
      updateTypesOnFileSystem: jest.fn(),
      addDataSource: jest.fn(),
    };

    jest.mocked(createAgent).mockReturnValue(agent as unknown as Agent);

    const sequelize = Symbol('sequelize');
    jest
      .mocked(buildDisconnectedSequelizeInstance)
      .mockResolvedValue(sequelize as unknown as Sequelize);

    const dataSourceSQL = Symbol('dataSource');
    jest
      .mocked(createSequelizeDataSource)
      .mockReturnValue(dataSourceSQL as unknown as DataSourceFactory);

    const mongoose = Symbol('mongoose');
    jest.mocked(buildDisconnectedMongooseInstance).mockReturnValue(mongoose as unknown as Mongoose);

    const dataSourceMongo = Symbol('dataSource');
    jest
      .mocked(createMongooseDataSource)
      .mockReturnValue(dataSourceMongo as unknown as DataSourceFactory);

    return { agent, sequelize, dataSourceSQL, dataSourceMongo, mongoose };
  }

  describe('if an error occurs', () => {
    describe('if the error is unexpected', () => {
      it('should rethrow it', async () => {
        const introspection: DataSourceMongoIntrospection = {
          models: [],
          source: '@forestadmin/datasource-mongo',
          version: 123,
        };

        const datasources = [{ introspection, datasourceSuffix: '_abc', datasourceId: 123 }];

        setupMocks();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        const error = new Error('Some random error occurred');
        jest.mocked(buildDisconnectedMongooseInstance).mockImplementation(() => {
          throw error;
        });

        await expect(updateTypings(datasources, bootstrapPathManager)).rejects.toEqual(error);
      });
    });

    describe('if the error is IntrospectionFormatError', () => {
      it('should map it to a business error', async () => {
        const introspection: DataSourceMongoIntrospection = {
          models: [],
          source: '@forestadmin/datasource-mongo',
          version: 123,
        };
        const datasources = [{ introspection, datasourceSuffix: '_abc', datasourceId: 123 }];

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        const error = new IntrospectionFormatError('@forestadmin/datasource-mongo');
        jest.mocked(buildDisconnectedMongooseInstance).mockImplementation(() => {
          throw error;
        });

        await expect(updateTypings(datasources, bootstrapPathManager)).rejects.toEqual(
          new BusinessError(
            `The version of this CLI is out of date from the version of your cloud agent.\nPlease update @forestadmin/forest-cloud.`,
          ),
        );
      });
    });
  });

  describe('updateTypings', () => {
    describe('with an introspection from a SQL datasource', () => {
      function generateDatasources() {
        const introspection = {
          source: '@forestadmin/datasource-sequelize',
          version: 1,
          tables: [],
        } as DataSourceSQLIntrospection;

        return [{ introspection, datasourceSuffix: '_abc', datasourceId: 123 }];
      }

      it('should create the agent with fake options', async () => {
        setupMocks();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(generateDatasources(), bootstrapPathManager);

        expect(createAgent).toHaveBeenCalledWith({
          authSecret: 'a'.repeat(64),
          envSecret: 'a'.repeat(64),
          loggerLevel: 'Error',
          isProduction: false,
        });
      });

      it('should create and add a fake SQL datasource', async () => {
        const { agent, sequelize, dataSourceSQL } = setupMocks();

        const datasources = generateDatasources();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(generateDatasources(), bootstrapPathManager);

        expect(buildDisconnectedSequelizeInstance).toHaveBeenCalledWith(
          datasources[0].introspection,
          null,
        );
        expect(createSequelizeDataSource).toHaveBeenCalledWith(sequelize);
        expect(agent.addDataSource).toHaveBeenCalledWith(dataSourceSQL, {
          rename: expect.any(Function),
        });
      });

      it('should update the types', async () => {
        const { agent } = setupMocks();

        const datasources = generateDatasources();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(datasources, bootstrapPathManager);

        expect(agent.updateTypesOnFileSystem).toHaveBeenCalledWith('typingsDuringBootstrap', 3);
      });
    });

    describe('with an introspection from a Mongo datasource', () => {
      function generateDatasources() {
        const introspection = {
          source: '@forestadmin/datasource-mongo',
          version: 1,
          models: [],
        } as DataSourceMongoIntrospection;

        return [{ introspection, datasourceSuffix: '_abc', datasourceId: 123 }];
      }

      it('should create the agent with fake options', async () => {
        setupMocks();

        const datasources = generateDatasources();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(datasources, bootstrapPathManager);

        expect(createAgent).toHaveBeenCalledWith({
          authSecret: 'a'.repeat(64),
          envSecret: 'a'.repeat(64),
          loggerLevel: 'Error',
          isProduction: false,
        });
      });

      it('should create and add a fake Mongo datasource', async () => {
        const { agent, dataSourceMongo, mongoose } = setupMocks();

        const datasources = generateDatasources();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(datasources, bootstrapPathManager);

        expect(buildDisconnectedMongooseInstance).toHaveBeenCalledWith(
          datasources[0].introspection,
        );

        expect(createMongooseDataSource).toHaveBeenCalledWith(mongoose, {
          flattenMode: 'auto',
        });
        expect(agent.addDataSource).toHaveBeenCalledWith(dataSourceMongo, {
          rename: expect.any(Function),
        });
      });

      it('should update the types', async () => {
        const { agent } = setupMocks();

        const datasources = generateDatasources();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(datasources, bootstrapPathManager);

        expect(agent.updateTypesOnFileSystem).toHaveBeenCalledWith('typingsDuringBootstrap', 3);
      });
    });
  });

  describe('updateTypingsWithCustomizations', () => {
    function setupParams() {
      const distPathManager = {
        distCodeCustomizations: 'distCodeCustomizations',
      } as DistPathManager;

      const bootstrapPathManager = {
        typings: 'typings',
      } as BootstrapPathManager;

      const introspectionSQL = {
        source: '@forestadmin/datasource-sql',
        version: 1,
        tables: [],
      } as DataSourceSQLIntrospection;

      const datasourcesSQL = [
        { introspection: introspectionSQL, datasourceSuffix: '-123', datasourceId: 123 },
      ];

      const introspectionMongo = {
        source: '@forestadmin/datasource-mongo',
        version: 1,
        models: [],
      } as DataSourceMongoIntrospection;

      const datasourcesMongo = [
        { introspection: introspectionMongo, datasourceSuffix: '-456', datasourceId: 456 },
      ];

      return { distPathManager, bootstrapPathManager, datasourcesSQL, datasourcesMongo };
    }

    it('should throw if there is no built code', async () => {
      jest.mocked(path.resolve).mockReturnValue('builtCodePath');
      jest.mocked(throwIfNoBuiltCode).mockRejectedValue(new Error('No built code'));

      const { distPathManager, bootstrapPathManager, datasourcesSQL } = setupParams();

      await expect(
        updateTypingsWithCustomizations(datasourcesSQL, distPathManager, bootstrapPathManager),
      ).rejects.toEqual(new Error('No built code'));

      expect(throwIfNoBuiltCode).toHaveBeenCalledWith('builtCodePath');
      expect(path.resolve).toHaveBeenCalledWith(distPathManager.distCodeCustomizations);
    });

    describe('with a SQL introspection', () => {
      it('should build the agent with a SQL datasource', async () => {
        const { distPathManager, bootstrapPathManager, datasourcesSQL } = setupParams();
        const { sequelize, agent, dataSourceSQL } = setupMocks();

        jest.mocked(throwIfNoBuiltCode).mockResolvedValue(undefined);

        await updateTypingsWithCustomizations(
          datasourcesSQL,
          distPathManager,
          bootstrapPathManager,
        );

        expect(createAgent).toHaveBeenCalledWith({
          authSecret: 'a'.repeat(64),
          envSecret: 'a'.repeat(64),
          loggerLevel: 'Error',
          isProduction: false,
        });

        expect(buildDisconnectedSequelizeInstance).toHaveBeenCalledWith(
          datasourcesSQL[0].introspection,
          null,
        );
        expect(createSequelizeDataSource).toHaveBeenCalledWith(sequelize);
        expect(agent.addDataSource).toHaveBeenCalledWith(dataSourceSQL, {
          rename: expect.any(Function),
        });
      });
    });

    describe('with a Mongo introspection', () => {
      it('should build the agent with a Mongo datasource', async () => {
        const { distPathManager, bootstrapPathManager, datasourcesMongo } = setupParams();
        const { mongoose, agent, dataSourceMongo } = setupMocks();

        jest.mocked(throwIfNoBuiltCode).mockResolvedValue(undefined);

        await updateTypingsWithCustomizations(
          datasourcesMongo,
          distPathManager,
          bootstrapPathManager,
        );

        expect(createAgent).toHaveBeenCalledWith({
          authSecret: 'a'.repeat(64),
          envSecret: 'a'.repeat(64),
          loggerLevel: 'Error',
          isProduction: false,
        });

        expect(buildDisconnectedMongooseInstance).toHaveBeenCalledWith(
          datasourcesMongo[0].introspection,
        );
        expect(createMongooseDataSource).toHaveBeenCalledWith(mongoose, { flattenMode: 'auto' });
        expect(agent.addDataSource).toHaveBeenCalledWith(dataSourceMongo, {
          rename: expect.any(Function),
        });
      });
    });

    it('should load the customizations and write types', async () => {
      const { distPathManager, bootstrapPathManager, datasourcesMongo } = setupParams();
      const { agent } = setupMocks();

      jest.mocked(path.resolve).mockReturnValue('builtCodePath');
      jest.mocked(throwIfNoBuiltCode).mockResolvedValue(undefined);

      await updateTypingsWithCustomizations(
        datasourcesMongo,
        distPathManager,
        bootstrapPathManager,
      );

      expect(loadCustomization).toHaveBeenCalledWith(agent, 'builtCodePath');
      expect(agent.updateTypesOnFileSystem).toHaveBeenCalledWith('typings', 3);
    });
  });
});
