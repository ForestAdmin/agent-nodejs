import {
  fetchForestSchema,
  getCollectionNames,
  clearSchemaCache,
  setSchemaCache,
  type ForestSchema,
} from '../../src/utils/schema-fetcher';

describe('schema-fetcher', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.FOREST_ENV_SECRET;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    process.env.FOREST_ENV_SECRET = 'test-env-secret';
    clearSchemaCache();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env.FOREST_ENV_SECRET = originalEnv;
  });

  // Helper to create JSON:API formatted schema response
  const createJsonApiSchema = (
    collections: Array<{ name: string; fields: Array<{ field: string; type: string }> }>,
  ) => ({
    data: collections.map((col, index) => ({
      id: `collection-${index}`,
      type: 'collections',
      attributes: {
        name: col.name,
        fields: col.fields,
      },
    })),
    meta: {
      liana: 'forest-express-sequelize',
      liana_version: '9.0.0',
      liana_features: null,
    },
  });

  describe('fetchForestSchema', () => {
    const mockJsonApiResponse = createJsonApiSchema([
      { name: 'users', fields: [{ field: 'id', type: 'Number' }] },
      { name: 'products', fields: [{ field: 'name', type: 'String' }] },
    ]);

    it('should fetch schema from forest server and deserialize JSON:API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJsonApiResponse),
      });

      const result = await fetchForestSchema('https://api.forestadmin.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.forestadmin.com/liana/forest-schema',
        {
          method: 'GET',
          headers: {
            'forest-secret-key': 'test-env-secret',
            'Content-Type': 'application/json',
          },
        },
      );
      expect(result.collections).toHaveLength(2);
      expect(result.collections[0].name).toBe('users');
      expect(result.collections[1].name).toBe('products');
    });

    it('should use cached schema on subsequent calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJsonApiResponse),
      });

      const result1 = await fetchForestSchema('https://api.forestadmin.com');
      const result2 = await fetchForestSchema('https://api.forestadmin.com');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should refetch schema after cache expires (24 hours)', async () => {
      const oldSchema: ForestSchema = {
        collections: [{ name: 'old_collection', fields: [] }],
      };
      const newJsonApiResponse = createJsonApiSchema([{ name: 'new_collection', fields: [] }]);

      // Set cache with an old timestamp (more than 24 hours ago)
      const oneDayAgo = Date.now() - 25 * 60 * 60 * 1000;
      setSchemaCache(oldSchema, oneDayAgo);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(newJsonApiResponse),
      });

      const result = await fetchForestSchema('https://api.forestadmin.com');

      expect(mockFetch).toHaveBeenCalledTimes(1);
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

      const result = await fetchForestSchema('https://api.forestadmin.com');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual(cachedSchema);
    });

    it('should throw error when FOREST_ENV_SECRET is not set', async () => {
      delete process.env.FOREST_ENV_SECRET;

      await expect(fetchForestSchema('https://api.forestadmin.com')).rejects.toThrow(
        'FOREST_ENV_SECRET environment variable is not set',
      );
    });

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Server error message'),
      });

      await expect(fetchForestSchema('https://api.forestadmin.com')).rejects.toThrow(
        'Failed to fetch forest schema: Server error message',
      );
    });

    it('should use custom forest server URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockJsonApiResponse),
      });

      await fetchForestSchema('https://custom.forestadmin.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.forestadmin.com/liana/forest-schema',
        expect.any(Object),
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
    // Helper to create JSON:API formatted schema response
    const createJsonApiSchema = (
      collections: Array<{ name: string; fields: Array<{ field: string; type: string }> }>,
    ) => ({
      data: collections.map((col, index) => ({
        id: `collection-${index}`,
        type: 'collections',
        attributes: {
          name: col.name,
          fields: col.fields,
        },
      })),
      meta: {
        liana: 'forest-express-sequelize',
        liana_version: '9.0.0',
        liana_features: null,
      },
    });

    it('should clear the cache so next fetch makes API call', async () => {
      const jsonApiResponse = createJsonApiSchema([{ name: 'test', fields: [] }]);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(jsonApiResponse),
      });

      // First fetch
      await fetchForestSchema('https://api.forestadmin.com');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      clearSchemaCache();

      // Second fetch should make API call
      await fetchForestSchema('https://api.forestadmin.com');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('setSchemaCache', () => {
    // Helper to create JSON:API formatted schema response
    const createJsonApiSchema = (
      collections: Array<{ name: string; fields: Array<{ field: string; type: string }> }>,
    ) => ({
      data: collections.map((col, index) => ({
        id: `collection-${index}`,
        type: 'collections',
        attributes: {
          name: col.name,
          fields: col.fields,
        },
      })),
      meta: {
        liana: 'forest-express-sequelize',
        liana_version: '9.0.0',
        liana_features: null,
      },
    });

    it('should set cache with current timestamp by default', async () => {
      const schema: ForestSchema = {
        collections: [{ name: 'cached', fields: [] }],
      };

      setSchemaCache(schema);

      const result = await fetchForestSchema('https://api.forestadmin.com');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual(schema);
    });

    it('should set cache with custom timestamp', async () => {
      const schema: ForestSchema = {
        collections: [{ name: 'old_cached', fields: [] }],
      };
      const newJsonApiResponse = createJsonApiSchema([{ name: 'new', fields: [] }]);

      // Set cache with old timestamp
      const oldTime = Date.now() - 25 * 60 * 60 * 1000;
      setSchemaCache(schema, oldTime);

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(newJsonApiResponse),
      });

      const result = await fetchForestSchema('https://api.forestadmin.com');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0].name).toBe('new');
    });
  });
});
