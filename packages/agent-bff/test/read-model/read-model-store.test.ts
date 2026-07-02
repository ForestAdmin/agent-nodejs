import type { SchemaFetcher } from '../../src/read-model/forest-schema-client';

import { makeMetrics, makeSchema } from './fixtures';
import CapabilitiesCache from '../../src/read-model/capabilities-cache';
import ReadModelStore from '../../src/read-model/read-model-store';
import SchemaCache, { ONE_DAY_MS } from '../../src/read-model/schema-cache';

describe('ReadModelStore', () => {
  let clock: number;
  const now = () => clock;

  function build(fetchSchema: jest.Mock): ReadModelStore {
    const metrics = makeMetrics();
    const schemaCache = new SchemaCache({
      fetcher: { fetchSchema } as SchemaFetcher,
      metrics,
      now,
    });
    const capabilitiesCache = new CapabilitiesCache({ now });

    return new ReadModelStore(schemaCache, capabilitiesCache);
  }

  beforeEach(() => {
    clock = 1_000_000;
  });

  describe('getReadModel', () => {
    it('should build the read-model from the fetched schema', async () => {
      const store = build(jest.fn().mockResolvedValue(makeSchema('users')));

      const model = await store.getReadModel();

      expect(model.isCollectionAllowed('users')).toBe(true);
    });

    it('should reuse the same read-model instance on a cache hit', async () => {
      const store = build(jest.fn().mockResolvedValue(makeSchema('users')));

      const a = await store.getReadModel();
      const b = await store.getReadModel();

      expect(a).toBe(b);
    });

    it('should rebuild the read-model after a schema refresh', async () => {
      const fetchSchema = jest
        .fn()
        .mockResolvedValueOnce(makeSchema('users'))
        .mockResolvedValueOnce(makeSchema('orders'));
      const store = build(fetchSchema);

      const before = await store.getReadModel();
      clock += ONE_DAY_MS;
      const after = await store.getReadModel();

      expect(before).not.toBe(after);
      expect(after.isCollectionAllowed('orders')).toBe(true);
      expect(after.isCollectionAllowed('users')).toBe(false);
    });
  });

  describe('capabilities coupling', () => {
    it('should fetch capabilities and cache them', async () => {
      const store = build(jest.fn().mockResolvedValue(makeSchema('users')));
      const capsFetcher = jest.fn().mockResolvedValue({ fields: [] });

      await store.getCapabilities('users', capsFetcher);
      await store.getCapabilities('users', capsFetcher);

      expect(capsFetcher).toHaveBeenCalledTimes(1);
    });

    it('should invalidate capabilities when the schema refreshes', async () => {
      const fetchSchema = jest
        .fn()
        .mockResolvedValueOnce(makeSchema('users'))
        .mockResolvedValueOnce(makeSchema('users'));
      const store = build(fetchSchema);
      const capsFetcher = jest.fn().mockResolvedValue({ fields: [] });

      await store.getCapabilities('users', capsFetcher);
      clock += ONE_DAY_MS;
      await store.getCapabilities('users', capsFetcher);

      expect(capsFetcher).toHaveBeenCalledTimes(2);
    });
  });
});
