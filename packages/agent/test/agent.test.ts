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
const mockAddWebhookActions = jest.fn();

const mockCustomizer = {
  addDataSource: jest.fn(),
  addChart: jest.fn(),
  customizeCollection: jest.fn(),
  updateTypesOnFileSystem: jest.fn(),
  use: jest.fn(),
  getFactory: jest.fn(),
};

const mockNocodeCustomizer = {
  addDataSource: jest.fn(),
  getDataSource: jest.fn(),
};

const mockDatasourceCustomizer = DataSourceCustomizer as jest.Mock;

jest.mock('../src/services/model-customizations/action-customization', () => ({
  __esModule: true,
  default: class {
    public static VERSION = '3.14.15';
    addWebhookActions = mockAddWebhookActions;
  },
}));

jest.mock('@forestadmin/datasource-customizer', () => ({
  __esModule: true,
  DataSourceCustomizer: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();

  mockDatasourceCustomizer
    .mockReset()
    .mockImplementationOnce(() => mockCustomizer)
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

    test('use should proxy the call', async () => {
      const agent = new Agent(options);
      agent.use(async () => {});

      expect(mockCustomizer.use).toHaveBeenCalledTimes(1);
    });

    // eslint-disable-next-line max-len
    test("should add the customizer's factory as a datasource for the nocode customizer", async () => {
      mockCustomizer.getFactory.mockReturnValueOnce('factory');

      const agent = new Agent(options);

      expect(agent).toBeTruthy();

      expect(mockNocodeCustomizer.addDataSource).toHaveBeenCalledTimes(1);
      expect(mockNocodeCustomizer.addDataSource).toHaveBeenCalledWith('factory');
    });

    test('start should upload apimap', async () => {
      const agent = new Agent(options);
      await agent.start();

      expect(mockSetupRoute).toHaveBeenCalledTimes(1);
      expect(mockBootstrap).toHaveBeenCalledTimes(1);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(1);
      expect(mockNocodeCustomizer.getDataSource).toHaveBeenCalledTimes(1);
      expect(mockCustomizer.updateTypesOnFileSystem).toHaveBeenCalledTimes(1);

      expect(mockPostSchema).toHaveBeenCalledWith({
        collections: [],
        metadata: {
          liana: 'forest-nodejs-agent',
          liana_version: expect.stringMatching(/\d+\.\d+\.\d+.*/),
          liana_features: null,
          stack: expect.anything(),
        },
      });

      expect(mockAddWebhookActions).not.toHaveBeenCalled();
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
        metadata: {
          liana: 'forest-nodejs-agent',
          liana_version: expect.stringMatching(/\d+\.\d+\.\d+.*/),
          liana_features: {
            'webhook-custom-actions': '3.14.15',
          },
          stack: expect.anything(),
        },
      });

      expect(mockAddWebhookActions).toHaveBeenCalledTimes(1);
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

    test('start should upload apimap when unknown', async () => {
      const agent = new Agent(options);
      await agent.start();

      expect(mockSetupRoute).toHaveBeenCalledTimes(1);
      expect(mockBootstrap).toHaveBeenCalledTimes(1);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(1);
      expect(mockNocodeCustomizer.getDataSource).toHaveBeenCalledTimes(1);
      expect(mockCustomizer.updateTypesOnFileSystem).not.toHaveBeenCalled();

      const schemaContent = JSON.parse(await readFile(options.schemaPath, 'utf8'));

      expect(mockPostSchema).toHaveBeenCalledWith(schemaContent);
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
});
