import type { ForestAdminServerInterface } from '../../src/types';

import SchemaService from '../../src/schema';
import * as factories from '../__factories__';

describe('SchemaService', () => {
  let mockForestAdminServerInterface: jest.Mocked<ForestAdminServerInterface>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockForestAdminServerInterface =
      factories.forestAdminServerInterface.build() as jest.Mocked<ForestAdminServerInterface>;
  });

  describe('the server does not know the schema', () => {
    beforeEach(() => {
      mockForestAdminServerInterface.checkSchemaHash.mockResolvedValue({ sendSchema: true });
      mockForestAdminServerInterface.postSchema.mockResolvedValue(undefined);
    });

    test('should post schema', async () => {
      const options = factories.forestAdminClientOptions.build();
      const schemaService = new SchemaService(mockForestAdminServerInterface, options);
      const sent = await schemaService.postSchema({
        collections: [],
        meta: {
          liana: 'forest-nodejs-agent',
          liana_version: '1.0.0',
          liana_features: null,
          stack: { engine: 'nodejs', engine_version: '16.0.0' },
        },
      });

      expect(sent).toBe(true);
      expect(mockForestAdminServerInterface.checkSchemaHash).toHaveBeenCalledTimes(1);
      expect(mockForestAdminServerInterface.checkSchemaHash).toHaveBeenCalledWith(
        { envSecret: options.envSecret, forestServerUrl: options.forestServerUrl },
        expect.any(String),
      );
      expect(mockForestAdminServerInterface.postSchema).toHaveBeenCalledTimes(1);
      expect(mockForestAdminServerInterface.postSchema).toHaveBeenCalledWith(
        { envSecret: options.envSecret, forestServerUrl: options.forestServerUrl },
        expect.objectContaining({
          data: [],
          jsonapi: { version: '1.0' },
          meta: {
            liana: 'forest-nodejs-agent',
            liana_version: '1.0.0',
            liana_features: null,
            stack: { engine: 'nodejs', engine_version: '16.0.0' },
            schemaFileHash: expect.any(String),
          },
        }),
      );
      expect(options.logger).toHaveBeenCalledTimes(1);
      expect(options.logger).toHaveBeenCalledWith(
        'Info',
        'Schema was updated, sending new version (hash: f61f747c5f1de29c3aa2a93da76a723ee3f50785)',
      );
    });
  });

  describe('the server knows the schema', () => {
    beforeEach(() => {
      mockForestAdminServerInterface.checkSchemaHash.mockResolvedValue({ sendSchema: false });
    });

    test('should not post schema if known by the server', async () => {
      const options = factories.forestAdminClientOptions.build();
      const schemaService = new SchemaService(mockForestAdminServerInterface, options);
      const sent = await schemaService.postSchema({
        collections: [],
        meta: {
          liana: 'forest-nodejs-agent',
          liana_version: '1.0.0',
          liana_features: null,
          stack: { engine: 'nodejs', engine_version: '16.0.0' },
        },
      });

      expect(sent).toBe(false);
      expect(mockForestAdminServerInterface.checkSchemaHash).toHaveBeenCalledTimes(1);
      expect(mockForestAdminServerInterface.postSchema).not.toHaveBeenCalled();
      expect(options.logger).toHaveBeenCalledTimes(1);
      expect(options.logger).toHaveBeenCalledWith(
        'Info',
        'Schema was not updated since last run (hash: f61f747c5f1de29c3aa2a93da76a723ee3f50785)',
      );
    });
  });

  describe('getSchema', () => {
    test('should fetch schema from ForestAdminServerInterface', async () => {
      const mockCollections = [
        {
          name: 'users',
          fields: [
            {
              field: 'id',
              type: 'Number',
              isPrimaryKey: true,
              enum: null,
              reference: null,
              isReadOnly: false,
              isRequired: true,
            },
          ],
        },
      ];
      mockForestAdminServerInterface.getSchema.mockResolvedValue(mockCollections);

      const options = factories.forestAdminClientOptions.build();
      const schemaService = new SchemaService(mockForestAdminServerInterface, options);
      const result = await schemaService.getSchema();

      expect(mockForestAdminServerInterface.getSchema).toHaveBeenCalledWith({
        envSecret: options.envSecret,
        forestServerUrl: options.forestServerUrl,
      });
      expect(result).toStrictEqual(mockCollections);
    });

    test('should propagate errors from the server', async () => {
      const networkError = new Error('Network error: connection refused');
      mockForestAdminServerInterface.getSchema.mockRejectedValue(networkError);

      const options = factories.forestAdminClientOptions.build();
      const schemaService = new SchemaService(mockForestAdminServerInterface, options);

      await expect(schemaService.getSchema()).rejects.toThrow('Network error: connection refused');
    });

    test('should propagate authentication errors', async () => {
      const authError = new Error('Forbidden: invalid credentials');
      mockForestAdminServerInterface.getSchema.mockRejectedValue(authError);

      const options = factories.forestAdminClientOptions.build();
      const schemaService = new SchemaService(mockForestAdminServerInterface, options);

      await expect(schemaService.getSchema()).rejects.toThrow('Forbidden: invalid credentials');
    });
  });
});
