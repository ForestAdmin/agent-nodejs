export const FORCED_REFETCH_INTERVAL_IN_SECONDS = 60;

export default class RefetchThrottle {
  private readonly lastRefetchByKey = new Map<string, number>();

  constructor(private readonly intervalInMs = FORCED_REFETCH_INTERVAL_IN_SECONDS * 1000) {}

  tryAcquire(key: string): boolean {
    const now = Date.now();
    const lastRefetch = this.lastRefetchByKey.get(key);

    if (lastRefetch !== undefined && now - lastRefetch < this.intervalInMs) return false;

    this.lastRefetchByKey.set(key, now);

    return true;
  }
}
