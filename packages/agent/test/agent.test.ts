/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { readFile } from 'fs/promises';

import * as factories from './__factories__';
import Agent from '../src/agent';

// Mock routes
const mockSetupRoute = jest.fn();
const mockBootstrap = jest.fn();
const mockMakeRoutes = jest.fn();

jest.mock('../src/routes', () => ({
  __esModule: true,
  default: (...args) => mockMakeRoutes(...args),
}));

// Mock options
const mockPostSchema = jest.fn();

const mockCustomizer = {
  addDataSource: jest.fn(),
  addChart: jest.fn(),
  customizeCollection: jest.fn(),
  updateTypesOnFileSystem: jest.fn(),
  getDataSource: jest.fn(),
  use: jest.fn(),
  getFactory: jest.fn(),
  removeCollection: jest.fn(),
};

const mockNocodeCustomizer = {
  addDataSource: jest.fn(),
  getDataSource: jest.fn(),
  use: jest.fn().mockReturnThis(),
};

const mockDatasourceCustomizer = DataSourceCustomizer as jest.Mock;

jest.mock('@forestadmin/datasource-customizer', () => ({
  __esModule: true,
  DataSourceCustomizer: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();

  mockDatasourceCustomizer
    .mockReset()
    .mockImplementationOnce(() => mockCustomizer)
    .mockImplementationOnce(() => mockNocodeCustomizer)
    .mockImplementationOnce(() => mockNocodeCustomizer);

  mockMakeRoutes.mockReturnValue([{ setupRoutes: mockSetupRoute, bootstrap: mockBootstrap }]);
  mockNocodeCustomizer.getDataSource.mockResolvedValue(factories.dataSource.build());
});

describe('Agent', () => {
  describe('Development', () => {
    const options = factories.forestAdminHttpDriverOptions.build({
      isProduction: false,
      typingsPath: '/tmp/test_typings.ts',
      forestAdminClient: factories.forestAdminClient.build({ postSchema: mockPostSchema }),
    });

    test('addDataSource should proxy the call', async () => {
      const collection = factories.collection.build({ name: 'books' });
      const dataSource = factories.dataSource.buildWithCollections([collection]);
      const factory = async () => dataSource;

      const agent = new Agent(options);
      agent.addDataSource(factory);

      expect(mockCustomizer.addDataSource).toHaveBeenCalledTimes(1);
    });

    test('addChart should proxy the call', async () => {
      const agent = new Agent(options);
      agent.addChart('name', () => 666);

      expect(mockCustomizer.addChart).toHaveBeenCalledTimes(1);
    });

    test('customizeCollection should proxy the call', async () => {
      const agent = new Agent(options);
      agent.customizeCollection('name', () => {});

      expect(mockCustomizer.customizeCollection).toHaveBeenCalledTimes(1);
    });

    test('removeCollection should proxy the call', async () => {
      const agent = new Agent(options);
      agent.removeCollection('name', 'name1');

      expect(mockCustomizer.removeCollection).toHaveBeenCalledTimes(1);
    });

    test('use should proxy the call', async () => {
      const agent = new Agent(options);
      agent.use(async () => {});

      expect(mockCustomizer.use).toHaveBeenCalledTimes(1);
    });

    test('use should be called before getDatasource in order to be correctly applied', async () => {
      const agent = new Agent(options);
      let useCalled = false;
      let getDataSourceCalledAfterUseCalled = false;

      mockNocodeCustomizer.use.mockImplementationOnce(async () => {
        useCalled = true;
      });

      mockNocodeCustomizer.getDataSource.mockImplementationOnce(async () => {
        getDataSourceCalledAfterUseCalled = useCalled;

        return factories.dataSource.build();
      });

      await agent.start();

      expect(mockNocodeCustomizer.use).toHaveBeenCalledTimes(1);
      expect(mockNocodeCustomizer.getDataSource).toHaveBeenCalledTimes(1);
      expect(getDataSourceCalledAfterUseCalled).toBe(true);
    });

    test("should add the customizer's factory as a datasource for the nocode customizer", async () => {
      mockCustomizer.getFactory.mockReturnValueOnce('factory');

      const agent = new Agent(options);
      await agent.start();

      expect(agent).toBeTruthy();

      expect(mockNocodeCustomizer.addDataSource).toHaveBeenCalledTimes(1);
      expect(mockNocodeCustomizer.addDataSource).toHaveBeenCalledWith('factory');
    });

    test('start should create new schema definition/meta and upload apimap', async () => {
      const agent = new Agent(options);
      await agent.start();

      expect(mockSetupRoute).toHaveBeenCalledTimes(1);
      expect(mockBootstrap).toHaveBeenCalledTimes(1);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(1);
      expect(mockNocodeCustomizer.getDataSource).toHaveBeenCalledTimes(1);
      expect(mockCustomizer.updateTypesOnFileSystem).toHaveBeenCalledTimes(1);

      expect(mockPostSchema).toHaveBeenCalledWith({
        collections: [],
        meta: {
          liana: 'forest-nodejs-agent',
          liana_version: expect.stringMatching(/\d+\.\d+\.\d+.*/),
          liana_features: null,
          stack: expect.anything(),
        },
      });
    });

    test('that should upload the schema with experimental features', async () => {
      const agent = new Agent({
        ...options,
        experimental: {
          webhookCustomActions: true,
        },
      });
      await agent.start();

      expect(mockSetupRoute).toHaveBeenCalledTimes(1);
      expect(mockBootstrap).toHaveBeenCalledTimes(1);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(1);
      expect(mockNocodeCustomizer.getDataSource).toHaveBeenCalledTimes(1);
      expect(mockCustomizer.updateTypesOnFileSystem).toHaveBeenCalledTimes(1);

      expect(mockPostSchema).toHaveBeenCalledWith({
        collections: [],
        meta: {
          liana: 'forest-nodejs-agent',
          liana_version: expect.stringMatching(/\d+\.\d+\.\d+.*/),
          liana_features: {
            'webhook-custom-actions': expect.stringMatching(/\d+\.\d+\.\d+.*/),
          },
          stack: expect.anything(),
        },
      });
    });

    test('start should subscribe server events and add listener to restart', async () => {
      const agent = new Agent({
        ...options,
        experimental: {
          webhookCustomActions: true,
        },
        instantCacheRefresh: true,
      });

      await agent.start();

      expect(options.forestAdminClient.subscribeToServerEvents).toHaveBeenCalledTimes(1);
      expect(options.forestAdminClient.onRefreshCustomizations).toHaveBeenCalledTimes(1);
    });

    test('restart should not subscribe server events and add listener to restart', async () => {
      const agent = new Agent({
        ...options,
        experimental: {
          webhookCustomActions: true,
        },
        instantCacheRefresh: true,
      });

      await agent.start();
      // @ts-expect-error: testing fakes RefreshCustomizations event
      await agent.restart();

      expect(options.forestAdminClient.subscribeToServerEvents).toHaveBeenCalledTimes(1);
      expect(options.forestAdminClient.onRefreshCustomizations).toHaveBeenCalledTimes(1);
    });

    test('restart should re-build datasource and re-bootstrap routes', async () => {
      const agent = new Agent({
        ...options,
        experimental: {
          webhookCustomActions: true,
        },
        instantCacheRefresh: true,
      });

      await agent.start();
      // @ts-expect-error: testing fakes RefreshCustomizations event
      await agent.restart();

      expect(mockSetupRoute).toHaveBeenCalledTimes(2);
      expect(mockBootstrap).toHaveBeenCalledTimes(2);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(2);
      expect(mockNocodeCustomizer.getDataSource).toHaveBeenCalledTimes(2);
      expect(mockCustomizer.updateTypesOnFileSystem).toHaveBeenCalledTimes(2);

      expect(mockNocodeCustomizer.use).toHaveBeenCalledTimes(2);
    });
  });

  describe('Production', () => {
    const options = factories.forestAdminHttpDriverOptions.build({
      isProduction: true,
      typingsPath: '/tmp/test_typings.ts',
      forestAdminClient: factories.forestAdminClient.build({ postSchema: mockPostSchema }),
      schemaPath: `${__dirname}/__data__/agent-schema.json`,
    });

    test('start should throw if the schema does not exists', async () => {
      const agent = new Agent({
        ...options,
        schemaPath: '/tmp/does_not_exists.json',
      });

      await expect(() => agent.start()).rejects.toThrow(
        'Providing a schema is mandatory in production',
      );
    });

    test('start should read existing definition and upload apimap with current meta', async () => {
      const agent = new Agent(options);
      await agent.start();

      expect(mockSetupRoute).toHaveBeenCalledTimes(1);
      expect(mockBootstrap).toHaveBeenCalledTimes(1);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(1);
      expect(mockNocodeCustomizer.getDataSource).toHaveBeenCalledTimes(1);
      expect(mockCustomizer.updateTypesOnFileSystem).not.toHaveBeenCalled();

      const { collections } = JSON.parse(await readFile(options.schemaPath, 'utf8'));

      expect(mockPostSchema).toHaveBeenCalledWith(
        expect.objectContaining({
          collections,
          meta: expect.objectContaining({
            liana: 'forest-nodejs-agent',
            liana_features: null,
            liana_version: expect.any(String),
          }),
        }),
      );
    });

    test('start should not update schema when specified', async () => {
      const agent = new Agent({ ...options, skipSchemaUpdate: true });
      await agent.start();

      expect(mockSetupRoute).toHaveBeenCalledTimes(1);
      expect(mockBootstrap).toHaveBeenCalledTimes(1);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(1);
      expect(mockNocodeCustomizer.getDataSource).toHaveBeenCalledTimes(1);
      expect(mockCustomizer.updateTypesOnFileSystem).not.toHaveBeenCalled();

      expect(mockPostSchema).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    test('stop should close the Forest Admin client', async () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const agent = new Agent(options);

      await agent.stop();

      expect(options.forestAdminClient.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateTypesOnFileSystem', () => {
    test('should write/update the typings file if apimap has changed', async () => {
      const options = factories.forestAdminHttpDriverOptions.build();
      const agent = new Agent(options);

      await agent.updateTypesOnFileSystem('the/path/to/typings.d.ts', 42);

      expect(mockCustomizer.getDataSource).toHaveBeenCalledOnceWith(options.logger);
      expect(mockCustomizer.updateTypesOnFileSystem).toHaveBeenCalledOnceWith(
        'the/path/to/typings.d.ts',
        42,
      );
    });
  });
});
