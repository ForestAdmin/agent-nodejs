import type { SchemaFetcher } from '../../src/read-model/forest-schema-client';

import { makeMetrics, makeSchema } from './fixtures';
import CapabilitiesCache from '../../src/read-model/capabilities-cache';
import ReadModelStore from '../../src/read-model/read-model-store';
import SchemaCache, { ONE_DAY_MS } from '../../src/read-model/schema-cache';

describe('ReadModelStore', () => {
  let clock: number;
  const now = () => clock;

  function build(fetchSchema: jest.Mock, clockOverride: () => number = now): ReadModelStore {
    const metrics = makeMetrics();
    const schemaCache = new SchemaCache({
      fetcher: { fetchSchema } as SchemaFetcher,
      metrics,
      now: clockOverride,
    });
    const capabilitiesCache = new CapabilitiesCache({ now: clockOverride });

    return new ReadModelStore(schemaCache, capabilitiesCache);
  }

  beforeEach(() => {
    clock = 1_000_000;
  });

  describe('getSchemaSnapshot', () => {
    it('should return a read-model derived from the very collections it returns', async () => {
      const store = build(jest.fn().mockResolvedValue(makeSchema('users')));

      const { collections, readModel, revision } = await store.getSchemaSnapshot();

      expect(collections.map(entry => entry.name)).toEqual(['users']);
      expect(readModel.getAllowedCollections()).toEqual(collections.map(entry => entry.name));
      expect(revision).toBe(1);
    });

    it('should read the schema once, so the read-model cannot come from a later generation', async () => {
      let generation = 0;

      const fetchSchema = jest.fn().mockImplementation(async () => {
        generation += 1;

        return makeSchema(`generation-${generation}`);
      });

      const alwaysExpiredClock = () => {
        clock += ONE_DAY_MS + 1;

        return clock;
      };

      const store = build(fetchSchema, alwaysExpiredClock);

      const { collections, readModel, revision } = await store.getSchemaSnapshot();

      expect(fetchSchema).toHaveBeenCalledTimes(1);
      expect(collections.map(entry => entry.name)).toEqual(['generation-1']);
      expect(readModel.getAllowedCollections()).toEqual(['generation-1']);
      expect(revision).toBe(1);
    });

    it('should read the cache revision once, so the triple cannot straddle two generations', async () => {
      const store = build(jest.fn().mockResolvedValue(makeSchema('users')));
      const cache = Reflect.get(store, 'schemaCache') as SchemaCache;
      let reads = 0;
      let bumped = 0;

      jest.spyOn(cache, 'revision', 'get').mockImplementation(() => {
        reads += 1;
        bumped += 1;

        return bumped;
      });

      const { revision } = await store.getSchemaSnapshot();

      expect(reads).toBe(1);
      expect(revision).toBe(1);
    });

    it('should not label one generation of collections with another generation revision', async () => {
      const fetchSchema = jest
        .fn()
        .mockResolvedValueOnce(makeSchema('first'))
        .mockResolvedValueOnce(makeSchema('second'));
      const store = build(fetchSchema);

      const first = await store.getSchemaSnapshot();
      clock += ONE_DAY_MS + 1;
      const second = await store.getSchemaSnapshot();

      expect(first.collections.map(entry => entry.name)).toEqual(['first']);
      expect(first.readModel.getAllowedCollections()).toEqual(['first']);
      expect(second.collections.map(entry => entry.name)).toEqual(['second']);
      expect(second.readModel.getAllowedCollections()).toEqual(['second']);
      expect(second.revision).toBeGreaterThan(first.revision);
    });
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

    // SchemaCache bumps `revision` inside its own refresh, before an awaiting getReadModel caller
    // resumes and installs the rebuilt model. Detecting the refresh by read-model identity misses
    // that window, so the retry must key on the revision instead.
    it('should retry when the revision moves while the read-model instance is not yet replaced', async () => {
      let releaseSchema: () => void = () => {};

      const blocked = new Promise<void>(resolve => {
        releaseSchema = resolve;
      });
      const fetchSchema = jest
        .fn()
        .mockResolvedValueOnce(makeSchema('users'))
        .mockImplementationOnce(async () => {
          await blocked;

          return makeSchema('orders');
        })
        .mockResolvedValue(makeSchema('orders'));
      const store = build(fetchSchema);
      await store.getReadModel();

      let disturbed = false;
      const capsFetcher = jest.fn(async () => {
        if (!disturbed) {
          disturbed = true;
          clock += ONE_DAY_MS;
          // Kick off the refresh and let SchemaCache bump its revision, but deliberately do NOT
          // await the rebuild: on return the revision has moved while the store still holds the
          // previous read-model instance. An identity check cannot see that; the revision can.
          void store.getReadModel();
          releaseSchema();
          await Promise.resolve();
        }

        return { fields: [{ name: 'tagged', type: 'String', operators: [] }] };
      });

      const { capabilities, readModel } = await store.getCapabilities('orders', capsFetcher);

      expect(readModel.isCollectionAllowed('orders')).toBe(true);
      expect(readModel.isCollectionAllowed('users')).toBe(false);
      expect(capsFetcher.mock.calls.length).toBeGreaterThan(1);
      expect(capabilities.fields[0].name).toBe('tagged');
    });

    it('should pair capabilities and read-model from one generation when a refresh lands mid-fetch', async () => {
      const fetchSchema = jest
        .fn()
        .mockResolvedValueOnce(makeSchema('users'))
        .mockResolvedValueOnce(makeSchema('orders'))
        .mockResolvedValue(makeSchema('orders'));
      const store = build(fetchSchema);
      const stale = await store.getReadModel();

      // Each fetch is tagged with the collection the current schema exposes, so a stale capabilities
      // result stays distinguishable from one belonging to the rebuilt read-model.
      let refreshed = false;
      const capsFetcher = jest.fn(async () => {
        if (!refreshed) {
          refreshed = true;
          clock += ONE_DAY_MS;
          await store.getReadModel();

          return { fields: [{ name: 'from-users-generation', type: 'String', operators: [] }] };
        }

        return { fields: [{ name: 'from-orders-generation', type: 'String', operators: [] }] };
      });

      const { capabilities, readModel } = await store.getCapabilities('orders', capsFetcher);

      expect(readModel).not.toBe(stale);
      expect(readModel.isCollectionAllowed('orders')).toBe(true);
      expect(capabilities.fields[0].name).toBe('from-orders-generation');
    });

    it('should not rebuild the read-model or clear capabilities when a refresh fails', async () => {
      const fetchSchema = jest
        .fn()
        .mockResolvedValueOnce(makeSchema('users'))
        .mockRejectedValueOnce(new Error('boom'));
      // Capabilities TTL kept longer than the schema TTL so this asserts the *clear* (not a
      // capabilities TTL expiry) does not happen on a warm schema-refresh failure.
      const schemaCache = new SchemaCache({
        fetcher: { fetchSchema } as SchemaFetcher,
        metrics: makeMetrics(),
        now,
      });
      const capabilitiesCache = new CapabilitiesCache({ now, ttlMs: ONE_DAY_MS * 10 });
      const store = new ReadModelStore(schemaCache, capabilitiesCache);
      const capsFetcher = jest.fn().mockResolvedValue({ fields: [] });

      const before = await store.getReadModel();
      await store.getCapabilities('users', capsFetcher);

      clock += ONE_DAY_MS;
      const after = await store.getReadModel();
      await store.getCapabilities('users', capsFetcher);

      expect(after).toBe(before);
      expect(capsFetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('ageSeconds', () => {
    it('should reflect the schema cache age of the last good schema', async () => {
      const store = build(jest.fn().mockResolvedValue(makeSchema('users')));

      await store.getReadModel();
      clock += 7_000;

      expect(store.ageSeconds()).toBe(7);
    });
  });

  describe('invalidate', () => {
    it('should re-read the schema on the next snapshot', async () => {
      const fetchSchema = jest.fn().mockResolvedValue(makeSchema('users'));
      const store = build(fetchSchema);
      await store.getSchemaSnapshot();

      store.invalidate();
      await store.getSchemaSnapshot();

      expect(fetchSchema).toHaveBeenCalledTimes(2);
    });

    it('should drop the capabilities with it, since they belong to the schema generation', async () => {
      const fetchSchema = jest.fn().mockResolvedValue(makeSchema('users'));
      const store = build(fetchSchema);
      const capabilities = jest.fn().mockResolvedValue({ fields: [] });
      await store.getCapabilities('users', capabilities);

      store.invalidate();
      await store.getCapabilities('users', capabilities);

      expect(capabilities).toHaveBeenCalledTimes(2);
    });
  });
});
