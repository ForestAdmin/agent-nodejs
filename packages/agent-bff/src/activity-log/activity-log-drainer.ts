interface InFlightOperation {
  promise: Promise<unknown>;
  /** What the drain names when a deadline leaves this one unfinished. Carries no record payload. */
  description: string;
}

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
  private readonly inFlight = new Set<InFlightOperation>();

  track<T>(operation: () => Promise<T>, description: string): Promise<T> {
    const promise = operation();
    const entry: InFlightOperation = { promise, description };
    this.inFlight.add(entry);
    promise.finally(() => this.inFlight.delete(entry)).catch(() => {});

    return promise;
  }

  /**
   * Loops rather than settling one snapshot: a transition is registered only once the request it
   * audits has finished, so a single pass would return before the work that outlives it.
   *
   * `timeoutMs` is the shutdown deadline the caller shares: a stalled audit store would otherwise
   * hold the process past the grace its orchestrator gives it, and be SIGKILLed mid-drain. Returns
   * what the deadline left unfinished, empty when everything settled.
   */
  async drain(timeoutMs?: number): Promise<string[]> {
    const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;

    while (this.inFlight.size > 0) {
      const remainingMs = deadline === undefined ? undefined : deadline - Date.now();

      if (remainingMs !== undefined && remainingMs <= 0) break;

      // eslint-disable-next-line no-await-in-loop
      await this.settle(remainingMs);
    }

    return [...this.inFlight].map(entry => entry.description);
  }

  private async settle(timeoutMs?: number): Promise<void> {
    const settled = Promise.allSettled([...this.inFlight].map(entry => entry.promise));

    if (timeoutMs === undefined) {
      await settled;

      return;
    }

    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        settled,
        new Promise<void>(resolve => {
          timer = setTimeout(resolve, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
