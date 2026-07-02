import type { CapabilitiesResult } from '../../src/read-model/capabilities-cache';

import CapabilitiesCache from '../../src/read-model/capabilities-cache';
import { ONE_DAY_MS } from '../../src/read-model/schema-cache';

function caps(name: string): CapabilitiesResult {
  return { fields: [{ name, type: 'String', operators: ['equal'] }] };
}

describe('CapabilitiesCache', () => {
  let clock: number;
  const now = () => clock;

  beforeEach(() => {
    clock = 1_000_000;
  });

  it('should fetch on first read and cache the raw result', async () => {
    const cache = new CapabilitiesCache({ now });
    const fetcher = jest.fn().mockResolvedValue(caps('email'));

    const result = await cache.get('users', fetcher);

    expect(fetcher).toHaveBeenCalledWith('users');
    expect(result).toEqual(caps('email'));
  });

  it('should serve from cache without re-fetching within 24h', async () => {
    const cache = new CapabilitiesCache({ now });
    const fetcher = jest.fn().mockResolvedValue(caps('email'));

    await cache.get('users', fetcher);
    clock += ONE_DAY_MS - 1;
    await cache.get('users', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should re-fetch after 24h', async () => {
    const cache = new CapabilitiesCache({ now });
    const fetcher = jest.fn().mockResolvedValue(caps('email'));

    await cache.get('users', fetcher);
    clock += ONE_DAY_MS;
    await cache.get('users', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('should cache per collection independently', async () => {
    const cache = new CapabilitiesCache({ now });
    const fetcher = jest
      .fn()
      .mockImplementation((collection: string) => Promise.resolve(caps(collection)));

    const users = await cache.get('users', fetcher);
    const orders = await cache.get('orders', fetcher);

    expect(users.fields[0].name).toBe('users');
    expect(orders.fields[0].name).toBe('orders');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('should re-fetch a collection after clear() (schema refresh invalidation)', async () => {
    const cache = new CapabilitiesCache({ now });
    const fetcher = jest.fn().mockResolvedValue(caps('email'));

    await cache.get('users', fetcher);
    cache.clear();
    await cache.get('users', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('should dedupe concurrent reads of the same collection into one fetch', async () => {
    const cache = new CapabilitiesCache({ now });
    let resolveFetch!: (value: CapabilitiesResult) => void;
    const fetcher = jest.fn().mockReturnValue(
      new Promise<CapabilitiesResult>(resolve => {
        resolveFetch = resolve;
      }),
    );

    const a = cache.get('users', fetcher);
    const b = cache.get('users', fetcher);
    resolveFetch(caps('email'));

    await Promise.all([a, b]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('should not repopulate the cache when a fetch that started before clear() resolves', async () => {
    const cache = new CapabilitiesCache({ now });
    let resolveStale!: (value: CapabilitiesResult) => void;
    const staleFetcher = jest.fn().mockReturnValue(
      new Promise<CapabilitiesResult>(resolve => {
        resolveStale = resolve;
      }),
    );

    const inFlight = cache.get('users', staleFetcher);
    cache.clear();
    resolveStale(caps('stale'));
    await inFlight;

    const freshFetcher = jest.fn().mockResolvedValue(caps('fresh'));
    const result = await cache.get('users', freshFetcher);

    expect(freshFetcher).toHaveBeenCalledTimes(1);
    expect(result.fields[0].name).toBe('fresh');
  });
});
