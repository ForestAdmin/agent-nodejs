export default class ActivityLogDrainer {
  private readonly inFlight = new Set<Promise<unknown>>();

  track<T>(fn: () => Promise<T>): Promise<T> {
    const promise = fn();
    this.inFlight.add(promise);
    // Swallow rejections on the cleanup chain so tracking a rejecting promise
    // doesn't cause UnhandledPromiseRejection. The original promise returned
    // to the caller still rejects normally.
    promise.finally(() => this.inFlight.delete(promise)).catch(() => {});

    return promise;
  }

  async drain(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }
}
