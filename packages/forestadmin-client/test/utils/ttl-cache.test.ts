import TTLCache from '../../src/utils/ttl-cache';

describe('TTL Cache', () => {
  describe('fetch', () => {
    it('should fetch resource', async () => {
      jest.useFakeTimers();

      const fetchMethod = jest.fn().mockResolvedValueOnce(12);

      const cache = new TTLCache<number>(fetchMethod);

      const result = await cache.fetch('key');

      expect(result).toBe(12);

      expect(fetchMethod).toHaveBeenCalledTimes(1);
      expect(fetchMethod).toHaveBeenCalledWith('key');
    });

    it('should reuse the cache if a second call is made before cache eviction', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(0);

      const fetchMethod = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const cache = new TTLCache<boolean>(fetchMethod);

      const fetch1 = await cache.fetch('key');

      // just before eviction
      jest.setSystemTime(1000 - 1);

      const fetch2 = await cache.fetch('key');

      expect(fetch1).toBe(true);
      expect(fetch2).toBe(true);

      expect(fetchMethod).toHaveBeenCalledTimes(1);
    });

    it('should update the cache if a second call is made after cache eviction', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(0);

      const fetchMethod = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

      const cache = new TTLCache<string>(fetchMethod);

      const fetch1 = await cache.fetch('key');

      // just after eviction
      jest.setSystemTime(1000 + 1);

      const fetch2 = await cache.fetch('key');
      const fetch3 = await cache.fetch('key');

      expect(fetch1).toEqual('first');
      expect(fetch2).toEqual('second');
      expect(fetch3).toEqual('second');

      expect(fetchMethod).toHaveBeenCalledTimes(2);
    });

    it('should not cache a rejected promise', async () => {
      const fetchMethod = jest
        .fn()
        .mockRejectedValueOnce(new Error('first'))
        .mockResolvedValueOnce('second');

      const cache = new TTLCache<string>(fetchMethod);

      await expect(() => cache.fetch('key')).rejects.toThrow('first');

      const fetch2 = await cache.fetch('key');
      expect(fetch2).toEqual('second');

      expect(fetchMethod).toHaveBeenCalledTimes(2);
    });
  });

  describe('clear', () => {
    it('should clear cache', async () => {
      const fetchMethod = jest.fn().mockResolvedValue(12);

      const cache = new TTLCache<number>(fetchMethod);

      await cache.fetch('key');

      // @ts-expect-error: private member for tests purpose
      expect(cache.stateMap.size).toEqual(1);

      cache.clear();

      // @ts-expect-error: private member for tests purpose
      expect(cache.stateMap.size).toEqual(0);

      await cache.fetch('key');

      expect(fetchMethod).toHaveBeenCalledTimes(2);
    });
  });

  describe('delete', () => {
    it('should delete cache key', async () => {
      const fetchMethod = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

      const cache = new TTLCache<number>(fetchMethod);

      await cache.fetch('key1');
      await cache.fetch('key2');

      // @ts-expect-error: private member for tests purpose
      expect(cache.stateMap.has('key1')).toEqual(true);

      cache.delete('key1');

      // @ts-expect-error: private member for tests purpose
      expect(cache.stateMap.has('key1')).toEqual(false);
      // @ts-expect-error: private member for tests purpose
      expect(cache.stateMap.size).toEqual(1);
    });
  });

  describe('behavior', () => {
    it('should not throw an error when fetching while clearing (non-regression test for #860rch4bz)', async () => {
      jest.useFakeTimers();

      const cache = new TTLCache<number>(
        async (key: string) =>
          // eslint-disable-next-line no-promise-executor-return
          new Promise<number>(r => setTimeout(() => r(Number(key)), 10)),
      );

      const valuePromise = cache.fetch('1');

      cache.clear();
      jest.advanceTimersByTime(10);

      const res = await valuePromise;

      expect(res).toEqual(1);
      // @ts-expect-error: private member for tests
      expect(cache.stateMap.has('1')).toBeFalse();
    });
  });
});
