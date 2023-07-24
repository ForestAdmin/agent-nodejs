import TTLCache from '../../src/utils/ttl-cache';

describe('TTL Cache', () => {
  it(
    // eslint-disable-next-line no-useless-concat
    'should not throw an error when fetching while clearing ' + '(regression test #860rch4bz)',
    async () => {
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
    },
  );
});
