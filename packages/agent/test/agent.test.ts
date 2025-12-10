/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { DataSourceFactory } from '@forestadmin/datasource-toolkit';

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

jest.mock('@forestadmin/datasource-customizer');

beforeEach(() => {
  jest.clearAllMocks();

  mockMakeRoutes.mockReturnValue([{ setupRoutes: mockSetupRoute, bootstrap: mockBootstrap }]);
  jest
    .mocked(DataSourceCustomizer.prototype.getDataSource)
    .mockResolvedValue(factories.dataSource.build());
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

      expect(DataSourceCustomizer.prototype.addDataSource).toHaveBeenCalledTimes(1);
    });

    test('addChart should proxy the call', async () => {
      const agent = new Agent(options);
      agent.addChart('name', () => 666);

      expect(DataSourceCustomizer.prototype.addChart).toHaveBeenCalledTimes(1);
    });

    test('customizeCollection should proxy the call', async () => {
      const agent = new Agent(options);
      agent.customizeCollection('name', () => {});

      expect(DataSourceCustomizer.prototype.customizeCollection).toHaveBeenCalledTimes(1);
    });

    test('removeCollection should proxy the call', async () => {
      const agent = new Agent(options);
      agent.removeCollection('name', 'name1');

      expect(DataSourceCustomizer.prototype.removeCollection).toHaveBeenCalledTimes(1);
    });

    test('use should proxy the call', async () => {
      const agent = new Agent(options);
      agent.use(async () => {});

      expect(DataSourceCustomizer.prototype.use).toHaveBeenCalledTimes(1);
    });

    test('use should be called before getDatasource in order to be correctly applied', async () => {
      const agent = new Agent(options);

      jest.mocked(DataSourceCustomizer.prototype.use).mockReturnThis();
      jest.mocked(DataSourceCustomizer.prototype.getDataSource).mockImplementationOnce(async () => {
        return factories.dataSource.build();
      });

      await agent.start();

      expect(DataSourceCustomizer.prototype.use).toHaveBeenCalledTimes(1);
      expect(DataSourceCustomizer.prototype.getDataSource).toHaveBeenCalledTimes(1);
      expect(DataSourceCustomizer.prototype.getDataSource).toHaveBeenCalledAfter(
        jest.mocked(DataSourceCustomizer.prototype.use),
      );
    });

    test("should add the customizer's factory as a datasource for the nocode customizer", async () => {
      jest
        .mocked(DataSourceCustomizer.prototype.getFactory)
        .mockReturnValueOnce('factory' as unknown as DataSourceFactory);

      const agent = new Agent(options);
      await agent.start();

      expect(agent).toBeTruthy();

      expect(DataSourceCustomizer.prototype.addDataSource).toHaveBeenCalledTimes(1);
      expect(DataSourceCustomizer.prototype.addDataSource).toHaveBeenCalledWith('factory');
    });

    test('start should create new schema definition/meta and upload apimap', async () => {
      const agent = new Agent(options);
      await agent.start();

      expect(mockSetupRoute).toHaveBeenCalledTimes(1);
      expect(mockBootstrap).toHaveBeenCalledTimes(1);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(1);
      expect(DataSourceCustomizer.prototype.getDataSource).toHaveBeenCalledTimes(1);
      expect(DataSourceCustomizer.prototype.updateTypesOnFileSystem).toHaveBeenCalledTimes(1);

      expect(mockPostSchema).toHaveBeenCalledWith({
        collections: [],
        meta: {
          liana: 'forest-nodejs-agent',
          liana_version: expect.stringMatching(/\d+\.\d+\.\d+.*/),
          liana_features: null,
          ai_llm: null,
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
      expect(DataSourceCustomizer.prototype.getDataSource).toHaveBeenCalledTimes(1);
      expect(DataSourceCustomizer.prototype.updateTypesOnFileSystem).toHaveBeenCalledTimes(1);

      expect(mockPostSchema).toHaveBeenCalledWith({
        collections: [],
        meta: {
          liana: 'forest-nodejs-agent',
          liana_version: expect.stringMatching(/\d+\.\d+\.\d+.*/),
          liana_features: {
            'webhook-custom-actions': expect.stringMatching(/\d+\.\d+\.\d+.*/),
          },
          ai_llm: null,
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
      await agent.restart();

      expect(mockSetupRoute).toHaveBeenCalledTimes(2);
      expect(mockBootstrap).toHaveBeenCalledTimes(2);
      expect(mockMakeRoutes).toHaveBeenCalledTimes(2);
      expect(DataSourceCustomizer.prototype.getDataSource).toHaveBeenCalledTimes(2);
      expect(DataSourceCustomizer.prototype.updateTypesOnFileSystem).toHaveBeenCalledTimes(2);

      expect(DataSourceCustomizer.prototype.use).toHaveBeenCalledTimes(2);
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
      expect(DataSourceCustomizer.prototype.getDataSource).toHaveBeenCalledTimes(1);
      expect(DataSourceCustomizer.prototype.updateTypesOnFileSystem).not.toHaveBeenCalled();

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
      expect(DataSourceCustomizer.prototype.getDataSource).toHaveBeenCalledTimes(1);
      expect(DataSourceCustomizer.prototype.updateTypesOnFileSystem).not.toHaveBeenCalled();

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

      expect(DataSourceCustomizer.prototype.getDataSource).toHaveBeenCalledOnceWith(options.logger);
      expect(DataSourceCustomizer.prototype.updateTypesOnFileSystem).toHaveBeenCalledOnceWith(
        'the/path/to/typings.d.ts',
        42,
      );
    });
  });

  describe('Datasource customizer', () => {
    it.each([true, false])('should set ignoreMissingSchemaElementErrors  to %s', async value => {
      const options = factories.forestAdminHttpDriverOptions.build();

      // eslint-disable-next-line no-new
      new Agent({ ...options, ignoreMissingSchemaElementErrors: value });

      expect(DataSourceCustomizer).toHaveBeenCalledWith(
        expect.objectContaining({
          ignoreMissingSchemaElementErrors: value,
        }),
      );
    });

    describe('Nocode customizer', () => {
      it.each([true, false])('provide the option to the underlying customizer', async value => {
        const options = factories.forestAdminHttpDriverOptions.build();

        // eslint-disable-next-line no-new
        const agent = new Agent({ ...options, ignoreMissingSchemaElementErrors: value });

        jest.clearAllMocks();

        await agent.start();

        expect(DataSourceCustomizer).toHaveBeenCalledWith(
          expect.objectContaining({
            ignoreMissingSchemaElementErrors: value,
          }),
        );
      });
    });
  });

  describe('addAi', () => {
    const options = factories.forestAdminHttpDriverOptions.build({
      isProduction: false,
      forestAdminClient: factories.forestAdminClient.build({ postSchema: mockPostSchema }),
    });

    test('should store the AI configuration', () => {
      const agent = new Agent(options);
      const result = agent.addAi({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
      });

      expect(result).toBe(agent);
    });

    test('should throw an error when called more than once', () => {
      const agent = new Agent(options);

      agent.addAi({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
      });

      expect(() =>
        agent.addAi({
          provider: 'openai',
          apiKey: 'another-key',
          model: 'gpt-4-turbo',
        }),
      ).toThrow('addAi() can only be called once');
    });

    test('should include ai_llm in schema meta when AI is configured', async () => {
      const agent = new Agent(options);
      agent.addAi({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
      });

      await agent.start();

      expect(mockPostSchema).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            ai_llm: 'openai',
          }),
        }),
      );
    });

    test('should not include ai_llm in schema meta when AI is not configured', async () => {
      const agent = new Agent(options);

      await agent.start();

      expect(mockPostSchema).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: expect.objectContaining({
            ai_llm: null,
          }),
        }),
      );
    });
  });
});
