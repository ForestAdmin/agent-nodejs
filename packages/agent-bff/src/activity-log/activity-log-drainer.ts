/**
 * Holds the audited requests and the status transitions they fire without `await`. Nothing else
 * keeps the transitions alive: `server.close()` waits for connections, and one sent after the
 * response is attached to none — without this, every deploy would leave entries stuck in `pending`.
 *
 * The requests are tracked too, and not only their transitions, for the embedded deployment: there
 * the host owns the connections, so `stop()` returns while requests are still running and their
 * transitions are not registered yet.
 */
export default class ActivityLogDrainer {
  private readonly inFlight = new Set<Promise<unknown>>();

  track<T>(operation: () => Promise<T>): Promise<T> {
    const promise = operation();
    this.inFlight.add(promise);
    promise.finally(() => this.inFlight.delete(promise)).catch(() => {});

    return promise;
  }

  /**
   * Loops rather than settling one snapshot: a transition is registered only once the request it
   * audits has finished, so a single pass would return before the work that outlives it. Bounded by
   * the agent transport's own timeout, which is what keeps a stalled request from holding a
   * shutdown open.
   */
  async drain(): Promise<void> {
    while (this.inFlight.size > 0) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.allSettled([...this.inFlight]);
    }
  }
}
