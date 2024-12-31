/**
 * Simplest TTL cache for multiple entries
 * Handles concurrent fetch by design
 */
export default class TTLCache<V> {
  private readonly stateMap = new Map<
    string,
    { promise: Promise<V | undefined>; expirationTimestamp: number }
  >();

  constructor(
    private readonly fetchMethod: (key: string) => Promise<V | undefined>,
    private readonly ttl = 1000,
  ) {}

  async fetch(key: string): Promise<V | undefined> {
    const now = Date.now();
    const state = this.stateMap.get(key);

    if (state && state.promise && state.expirationTimestamp && state.expirationTimestamp > now) {
      return state.promise;
    }

    const fetch = this.fetchMethod(key);
    this.stateMap.set(key, { promise: fetch, expirationTimestamp: now + this.ttl });

    fetch.catch(() => {
      // Don't cache rejected promises
      this.stateMap.delete(key);
    });

    return fetch;
  }

  clear() {
    this.stateMap.clear();
  }

  delete(key: string) {
    this.stateMap.delete(key);
  }
}
