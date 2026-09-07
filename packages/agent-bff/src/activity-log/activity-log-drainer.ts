/**
 * Holds the status transitions that are fired without `await`. Nothing else keeps them alive:
 * `server.close()` waits for connections, and a transition sent after the response is attached to
 * none — without this, every deploy would leave entries stuck in `pending`.
 */
export default class ActivityLogDrainer {
  private readonly inFlight = new Set<Promise<unknown>>();

  track<T>(operation: () => Promise<T>): Promise<T> {
    const promise = operation();
    this.inFlight.add(promise);
    promise.finally(() => this.inFlight.delete(promise)).catch(() => {});

    return promise;
  }

  async drain(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }
}
