import PaginationCache from '../../src/utils/pagination-cache';

describe('PaginationCache', () => {
  it('returns nothing for an unknown query', () => {
    expect(new PaginationCache().findBestToken('q', 100)).toBeUndefined();
  });

  it('resumes from the closest stored offset not past the target', () => {
    const cache = new PaginationCache();
    cache.storeToken('q', 100, { pk: 'a' });
    cache.storeToken('q', 300, { pk: 'c' });
    cache.storeToken('q', 500, { pk: 'e' });

    expect(cache.findBestToken('q', 400)).toEqual({ offset: 300, startKey: { pk: 'c' } });
  });

  it('never resumes past the target offset', () => {
    const cache = new PaginationCache();
    cache.storeToken('q', 500, { pk: 'e' });

    expect(cache.findBestToken('q', 400)).toBeUndefined();
  });

  it('keeps queries apart', () => {
    const cache = new PaginationCache();
    cache.storeToken('q1', 100, { pk: 'a' });

    expect(cache.findBestToken('q2', 200)).toBeUndefined();
  });

  it('drops entries older than the time to live', () => {
    let now = 1000;
    const cache = new PaginationCache({ ttlMs: 50, now: () => now });
    cache.storeToken('q', 100, { pk: 'a' });

    now += 51;

    expect(cache.findBestToken('q', 200)).toBeUndefined();
  });

  it('keeps at most maxEntriesPerQuery entries, dropping the oldest', () => {
    const cache = new PaginationCache({ maxEntriesPerQuery: 2 });
    cache.storeToken('q', 100, { pk: 'a' });
    cache.storeToken('q', 200, { pk: 'b' });
    cache.storeToken('q', 300, { pk: 'c' });

    expect(cache.findBestToken('q', 150)).toBeUndefined();
    expect(cache.findBestToken('q', 350)).toEqual({ offset: 300, startKey: { pk: 'c' } });
  });

  it('forgets every query of a table when it is invalidated', () => {
    const cache = new PaginationCache();
    cache.storeToken('q', 100, { pk: 'a' }, 'Orders');
    cache.storeToken('r', 100, { pk: 'a' }, 'Users');

    cache.invalidateTable('Orders');

    expect(cache.findBestToken('q', 200)).toBeUndefined();
    expect(cache.findBestToken('r', 200)).toBeDefined();
  });

  it('hashes the same query to the same key and different ones apart', () => {
    const cache = new PaginationCache();

    expect(cache.hash({ a: 1, b: [2] })).toBe(cache.hash({ a: 1, b: [2] }));
    expect(cache.hash({ a: 1 })).not.toBe(cache.hash({ a: 2 }));
  });

  it('exposes the interval between remembered positions', () => {
    const cache = new PaginationCache({ cacheInterval: 7 });

    expect(cache.getCacheInterval()).toBe(7);
  });
});
