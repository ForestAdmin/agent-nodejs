import type { ForestServerClient } from '../../src/http-client';

import {
  type ForestSchema,
  clearSchemaCache,
  fetchForestSchema,
  getActionEndpoints,
  getCollectionNames,
  setSchemaCache,
} from '../../src/utils/schema-fetcher';
import createMockForestServerClient from '../helpers/forest-server-client';

describe('schema-fetcher', () => {
  let mockForestServerClient: jest.Mocked<ForestServerClient>;

  beforeEach(() => {
    mockForestServerClient = createMockForestServerClient();
    clearSchemaCache();
  });

  describe('fetchForestSchema', () => {
    const mockCollections = [
      { name: 'users', fields: [{ field: 'id', type: 'Number' }] },
      { name: 'products', fields: [{ field: 'name', type: 'String' }] },
    ];

    it('should fetch schema from http client and return collections', async () => {
      mockForestServerClient.fetchSchema.mockResolvedValue(mockCollections as any);

      const result = await fetchForestSchema(mockForestServerClient);

      expect(mockForestServerClient.fetchSchema).toHaveBeenCalled();
      expect(result.collections).toHaveLength(2);
      expect(result.collections[0].name).toBe('users');
      expect(result.collections[1].name).toBe('products');
    });

    it('should use cached schema on subsequent calls', async () => {
      mockForestServerClient.fetchSchema.mockResolvedValue(mockCollections as any);

      const result1 = await fetchForestSchema(mockForestServerClient);
      const result2 = await fetchForestSchema(mockForestServerClient);

      expect(mockForestServerClient.fetchSchema).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should refetch schema after cache expires (24 hours)', async () => {
      const oldSchema: ForestSchema = {
        collections: [{ name: 'old_collection', fields: [] }],
      };
      const newCollections = [{ name: 'new_collection', fields: [] }];

      // Set cache with an old timestamp (more than 24 hours ago)
      const oneDayAgo = Date.now() - 25 * 60 * 60 * 1000;
      setSchemaCache(oldSchema, oneDayAgo);

      mockForestServerClient.fetchSchema.mockResolvedValue(newCollections as any);

      const result = await fetchForestSchema(mockForestServerClient);

      expect(mockForestServerClient.fetchSchema).toHaveBeenCalledTimes(1);
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0].name).toBe('new_collection');
    });

    it('should not refetch schema before cache expires', async () => {
      const cachedSchema: ForestSchema = {
        collections: [{ name: 'cached_collection', fields: [] }],
      };

      // Set cache with a recent timestamp (less than 24 hours ago)
      const recentTime = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago
      setSchemaCache(cachedSchema, recentTime);

      const result = await fetchForestSchema(mockForestServerClient);

      expect(mockForestServerClient.fetchSchema).not.toHaveBeenCalled();
      expect(result).toEqual(cachedSchema);
    });

    it('should throw error when http client fetchSchema fails', async () => {
      mockForestServerClient.fetchSchema.mockRejectedValue(
        new Error('Failed to fetch forest schema: Server error message'),
      );

      await expect(fetchForestSchema(mockForestServerClient)).rejects.toThrow(
        'Failed to fetch forest schema: Server error message',
      );
    });
  });

  describe('getCollectionNames', () => {
    it('should extract collection names from schema', () => {
      const schema: ForestSchema = {
        collections: [
          { name: 'users', fields: [] },
          { name: 'products', fields: [] },
          { name: 'orders', fields: [] },
        ],
      };

      const result = getCollectionNames(schema);

      expect(result).toEqual(['users', 'products', 'orders']);
    });

    it('should return empty array for empty collections', () => {
      const schema: ForestSchema = {
        collections: [],
      };

      const result = getCollectionNames(schema);

      expect(result).toEqual([]);
    });
  });

  describe('clearSchemaCache', () => {
    it('should clear the cache so next fetch makes API call', async () => {
      const collections = [{ name: 'test', fields: [] }];

      mockForestServerClient.fetchSchema.mockResolvedValue(collections as any);

      // First fetch
      await fetchForestSchema(mockForestServerClient);
      expect(mockForestServerClient.fetchSchema).toHaveBeenCalledTimes(1);

      // Clear cache
      clearSchemaCache();

      // Second fetch should make API call
      await fetchForestSchema(mockForestServerClient);
      expect(mockForestServerClient.fetchSchema).toHaveBeenCalledTimes(2);
    });
  });

  describe('setSchemaCache', () => {
    it('should set cache with current timestamp by default', async () => {
      const schema: ForestSchema = {
        collections: [{ name: 'cached', fields: [] }],
      };

      setSchemaCache(schema);

      const result = await fetchForestSchema(mockForestServerClient);

      expect(mockForestServerClient.fetchSchema).not.toHaveBeenCalled();
      expect(result).toEqual(schema);
    });

    it('should set cache with custom timestamp', async () => {
      const schema: ForestSchema = {
        collections: [{ name: 'old_cached', fields: [] }],
      };
      const newCollections = [{ name: 'new', fields: [] }];

      // Set cache with old timestamp
      const oldTime = Date.now() - 25 * 60 * 60 * 1000;
      setSchemaCache(schema, oldTime);

      mockForestServerClient.fetchSchema.mockResolvedValue(newCollections as any);

      const result = await fetchForestSchema(mockForestServerClient);

      expect(mockForestServerClient.fetchSchema).toHaveBeenCalledTimes(1);
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0].name).toBe('new');
    });
  });

  describe('getActionEndpoints', () => {
    const createAction = (name: string, endpoint: string) => ({
      id: `action-${name.toLowerCase().replace(/\s/g, '-')}`,
      name,
      type: 'single' as const,
      endpoint,
      download: false,
      fields: [],
      hooks: { load: false, change: [] },
    });

    it('should extract action endpoints from schema', () => {
      const schema: ForestSchema = {
        collections: [
          {
            name: 'users',
            fields: [],
            actions: [
              createAction('Send Email', '/forest/_actions/users/0/send-email'),
              createAction('Reset Password', '/forest/_actions/users/1/reset-password'),
            ],
          },
          {
            name: 'orders',
            fields: [],
            actions: [createAction('Refund', '/forest/_actions/orders/0/refund')],
          },
        ],
      };

      const result = getActionEndpoints(schema);

      expect(result).toEqual({
        users: {
          'Send Email': { name: 'Send Email', endpoint: '/forest/_actions/users/0/send-email' },
          'Reset Password': {
            name: 'Reset Password',
            endpoint: '/forest/_actions/users/1/reset-password',
          },
        },
        orders: {
          Refund: { name: 'Refund', endpoint: '/forest/_actions/orders/0/refund' },
        },
      });
    });

    it('should return empty object for collections without actions', () => {
      const schema: ForestSchema = {
        collections: [
          { name: 'users', fields: [] },
          { name: 'products', fields: [] },
        ],
      };

      const result = getActionEndpoints(schema);

      expect(result).toEqual({});
    });

    it('should skip collections with empty actions array', () => {
      const schema: ForestSchema = {
        collections: [
          { name: 'users', fields: [], actions: [] },
          {
            name: 'orders',
            fields: [],
            actions: [createAction('Ship', '/forest/_actions/orders/0/ship')],
          },
        ],
      };

      const result = getActionEndpoints(schema);

      expect(result).toEqual({
        orders: {
          Ship: { name: 'Ship', endpoint: '/forest/_actions/orders/0/ship' },
        },
      });
    });

    it('should return empty object for empty collections', () => {
      const schema: ForestSchema = {
        collections: [],
      };

      const result = getActionEndpoints(schema);

      expect(result).toEqual({});
    });
  });
});
