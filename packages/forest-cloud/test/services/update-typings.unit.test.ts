import type { Introspection as DataSourceMongoIntrospection } from '@forestadmin/datasource-mongo';
import type { SupportedIntrospection as DataSourceSQLIntrospection } from '@forestadmin/datasource-sql';
import type { DataSourceFactory } from '@forestadmin/datasource-toolkit';
import type { Mongoose } from 'mongoose';
import type { Sequelize } from 'sequelize';

import { Agent, createAgent } from '@forestadmin/agent';
import { buildDisconnectedMongooseInstance } from '@forestadmin/datasource-mongo';
import { createMongooseDataSource } from '@forestadmin/datasource-mongoose';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { buildDisconnectedSequelizeInstance } from '@forestadmin/datasource-sql';
import { BusinessError, IntrospectionFormatError } from '@forestadmin/datasource-toolkit';
import path from 'path';

import { throwIfNoBuiltCode } from '../../src/services/access-file';
import BootstrapPathManager from '../../src/services/bootstrap-path-manager';
import DistPathManager from '../../src/services/dist-path-manager';
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

        setupMocks();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        const error = new Error('Some random error occurred');
        jest.mocked(buildDisconnectedMongooseInstance).mockImplementation(() => {
          throw error;
        });

        await expect(
          updateTypings(introspection as DataSourceMongoIntrospection, bootstrapPathManager),
        ).rejects.toEqual(error);
      });
    });

    describe('if the error is IntrospectionFormatError', () => {
      it('should map it to a business error', async () => {
        const introspection: DataSourceMongoIntrospection = {
          models: [],
          source: '@forestadmin/datasource-mongo',
          version: 123,
        };

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        const error = new IntrospectionFormatError('@forestadmin/datasource-mongo');
        jest.mocked(buildDisconnectedMongooseInstance).mockImplementation(() => {
          throw error;
        });

        await expect(
          updateTypings(introspection as DataSourceMongoIntrospection, bootstrapPathManager),
        ).rejects.toEqual(
          new BusinessError(
            `The version of this CLI is out of date from the version of your cloud agent.\nPlease update @forestadmin/forest-cloud.`,
          ),
        );
      });
    });
  });

  describe('updateTypings', () => {
    describe('with an introspection from a SQL datasource', () => {
      function generateIntrospection() {
        return {
          source: '@forestadmin/datasource-sequelize',
          version: 1,
          tables: [],
        } as DataSourceSQLIntrospection;
      }

      it('should create the agent with fake options', async () => {
        setupMocks();

        const introspection = generateIntrospection();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(introspection, bootstrapPathManager);

        expect(createAgent).toHaveBeenCalledWith({
          authSecret: 'a'.repeat(64),
          envSecret: 'a'.repeat(64),
          loggerLevel: 'Error',
          isProduction: false,
        });
      });

      it('should create and add a fake SQL datasource', async () => {
        const { agent, sequelize, dataSourceSQL } = setupMocks();

        const introspection = generateIntrospection();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(introspection, bootstrapPathManager);

        expect(buildDisconnectedSequelizeInstance).toHaveBeenCalledWith(introspection, null);
        expect(createSequelizeDataSource).toHaveBeenCalledWith(sequelize);
        expect(agent.addDataSource).toHaveBeenCalledWith(dataSourceSQL);
      });

      it('should update the types', async () => {
        const { agent } = setupMocks();

        const introspection = generateIntrospection();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(introspection, bootstrapPathManager);

        expect(agent.updateTypesOnFileSystem).toHaveBeenCalledWith('typingsDuringBootstrap', 3);
      });
    });

    describe('with an introspection from a Mongo datasource', () => {
      function generateIntrospection() {
        return {
          source: '@forestadmin/datasource-mongo',
          version: 1,
          models: [],
        } as DataSourceMongoIntrospection;
      }

      it('should create the agent with fake options', async () => {
        setupMocks();

        const introspection = generateIntrospection();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(introspection, bootstrapPathManager);

        expect(createAgent).toHaveBeenCalledWith({
          authSecret: 'a'.repeat(64),
          envSecret: 'a'.repeat(64),
          loggerLevel: 'Error',
          isProduction: false,
        });
      });

      it('should create and add a fake Mongo datasource', async () => {
        const { agent, dataSourceMongo, mongoose } = setupMocks();

        const introspection = generateIntrospection();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(introspection, bootstrapPathManager);

        expect(buildDisconnectedMongooseInstance).toHaveBeenCalledWith(introspection);
        expect(createMongooseDataSource).toHaveBeenCalledWith(mongoose, { flattenMode: 'auto' });
        expect(agent.addDataSource).toHaveBeenCalledWith(dataSourceMongo);
      });

      it('should update the types', async () => {
        const { agent } = setupMocks();

        const introspection = generateIntrospection();

        const bootstrapPathManager = {
          typingsDuringBootstrap: 'typingsDuringBootstrap',
        } as BootstrapPathManager;

        await updateTypings(introspection, bootstrapPathManager);

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

      const introspectionMongo = {
        source: '@forestadmin/datasource-mongo',
        version: 1,
        models: [],
      } as DataSourceMongoIntrospection;

      return { distPathManager, bootstrapPathManager, introspectionSQL, introspectionMongo };
    }

    it('should throw if there is no built code', async () => {
      jest.mocked(path.resolve).mockReturnValue('builtCodePath');
      jest.mocked(throwIfNoBuiltCode).mockRejectedValue(new Error('No built code'));

      const { distPathManager, bootstrapPathManager, introspectionSQL } = setupParams();

      await expect(
        updateTypingsWithCustomizations(introspectionSQL, distPathManager, bootstrapPathManager),
      ).rejects.toEqual(new Error('No built code'));

      expect(throwIfNoBuiltCode).toHaveBeenCalledWith('builtCodePath');
      expect(path.resolve).toHaveBeenCalledWith(distPathManager.distCodeCustomizations);
    });

    describe('with a SQL introspection', () => {
      it('should build the agent with a SQL datasource', async () => {
        const { distPathManager, bootstrapPathManager, introspectionSQL } = setupParams();
        const { sequelize, agent, dataSourceSQL } = setupMocks();

        jest.mocked(throwIfNoBuiltCode).mockResolvedValue(undefined);

        await updateTypingsWithCustomizations(
          introspectionSQL,
          distPathManager,
          bootstrapPathManager,
        );

        expect(createAgent).toHaveBeenCalledWith({
          authSecret: 'a'.repeat(64),
          envSecret: 'a'.repeat(64),
          loggerLevel: 'Error',
          isProduction: false,
        });

        expect(buildDisconnectedSequelizeInstance).toHaveBeenCalledWith(introspectionSQL, null);
        expect(createSequelizeDataSource).toHaveBeenCalledWith(sequelize);
        expect(agent.addDataSource).toHaveBeenCalledWith(dataSourceSQL);
      });
    });

    describe('with a Mongo introspection', () => {
      it('should build the agent with a Mongo datasource', async () => {
        const { distPathManager, bootstrapPathManager, introspectionMongo } = setupParams();
        const { mongoose, agent, dataSourceMongo } = setupMocks();

        jest.mocked(throwIfNoBuiltCode).mockResolvedValue(undefined);

        await updateTypingsWithCustomizations(
          introspectionMongo,
          distPathManager,
          bootstrapPathManager,
        );

        expect(createAgent).toHaveBeenCalledWith({
          authSecret: 'a'.repeat(64),
          envSecret: 'a'.repeat(64),
          loggerLevel: 'Error',
          isProduction: false,
        });

        expect(buildDisconnectedMongooseInstance).toHaveBeenCalledWith(introspectionMongo);
        expect(createMongooseDataSource).toHaveBeenCalledWith(mongoose, { flattenMode: 'auto' });
        expect(agent.addDataSource).toHaveBeenCalledWith(dataSourceMongo);
      });
    });

    it('should load the customizations and write types', async () => {
      const { distPathManager, bootstrapPathManager, introspectionSQL } = setupParams();
      const { agent } = setupMocks();

      jest.mocked(path.resolve).mockReturnValue('builtCodePath');
      jest.mocked(throwIfNoBuiltCode).mockResolvedValue(undefined);

      await updateTypingsWithCustomizations(
        introspectionSQL,
        distPathManager,
        bootstrapPathManager,
      );

      expect(loadCustomization).toHaveBeenCalledWith(agent, 'builtCodePath');
      expect(agent.updateTypesOnFileSystem).toHaveBeenCalledWith('typings', 3);
    });
  });
});
