/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/no-explicit-any */

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

// Mock customizer
const mockAddDataSource = jest.fn();
const mockAddChart = jest.fn();
const mockGetDataSource = jest.fn();
const mockCustomizeCollection = jest.fn();
const mockUpdateTypesOnFileSystem = jest.fn();
const mockUse = jest.fn();
const mockAddWebhookActions = jest.fn();

jest.mock('@forestadmin/datasource-customizer', () => ({
  DataSourceCustomizer: class {
    addDataSource = mockAddDataSource;
    addChart = mockAddChart;
    getDataSource = mockGetDataSource;
    customizeCollection = mockCustomizeCollection;
    updateTypesOnFileSystem = mockUpdateTypesOnFileSystem;
    use = mockUse;
  },
}));

jest.mock('../src/services/model-customizations/action-customization', () => ({
  __esModule: true,
  default: class {
    public static VERSION = '3.14.15';
    addWebhookActions = mockAddWebhookActions;
  },
}));

beforeEach(() => {
  jest.resetAllMocks();

  mockMakeRoutes.mockReturnValue([{ setupRoutes: mockSetupRoute, bootstrap: mockBootstrap }]);
  mockGetDataSource.mockResolvedValue(factories.dataSource.build());
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

      expect(mockAddDataSource).toHaveBeenCalledTimes(1);
    });

    test('addChart should proxy the call', async () => {
      const agent = new Agent(options);
      agent.addChart('name', () => 666);

      expect(mockAddChart).toHaveBeenCalledTimes(1);
    });

    test('customizeCollection should proxy the call', async () => {
      const agent = new Agent(options);
      agent.customizeCollection('name', () => {});

      expect(mockCustomizeCollection).toHaveBeenCalledTimes(1);
    });

    test('use should proxy the call', async () => {
      const agent = new Agent(options);
      agent.use(async () => {});

      expect(mockUse).toHaveBeenCalledTimes(1);
    });

    test('start should upload apimap', async () => {
      const agent = new Agent(options);
      await agent.start();

      expect(mockSetupRoute).toHaveBeenCalledTimes(1);
      expect(mockBootstrap).toHaveBeenCalledTimes(1);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(1);
      expect(mockGetDataSource).toHaveBeenCalledTimes(1);
      expect(mockUpdateTypesOnFileSystem).toHaveBeenCalledTimes(1);

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
      expect(mockGetDataSource).toHaveBeenCalledTimes(1);
      expect(mockUpdateTypesOnFileSystem).toHaveBeenCalledTimes(1);

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
      expect(mockGetDataSource).toHaveBeenCalledTimes(1);
      expect(mockUpdateTypesOnFileSystem).not.toHaveBeenCalled();

      const schemaContent = JSON.parse(await readFile(options.schemaPath, 'utf8'));

      expect(mockPostSchema).toHaveBeenCalledWith(schemaContent);
    });

    test('start should not update schema when specified', async () => {
      const agent = new Agent({ ...options, skipSchemaUpdate: true });
      await agent.start();

      expect(mockSetupRoute).toHaveBeenCalledTimes(1);
      expect(mockBootstrap).toHaveBeenCalledTimes(1);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(1);
      expect(mockGetDataSource).toHaveBeenCalledTimes(1);
      expect(mockUpdateTypesOnFileSystem).not.toHaveBeenCalled();
      expect(mockPostSchema).not.toHaveBeenCalled();
    });
  });
});
