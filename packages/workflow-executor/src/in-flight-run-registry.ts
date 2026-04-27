// Tracks promises for runs currently executing (including their full auto-chain).
// Keyed by runId — a run has one available step at a time, and a chain advances the stepId
// between iterations. Keying by runId keeps the dedup guarantee across the whole chain.
export default class InFlightRunRegistry {
  private readonly runs = new Map<string, Promise<void>>();

  get size() {
    return this.runs.size;
  }

  keys() {
    return [...this.runs.keys()];
  }

  has(runId: string) {
    return this.runs.has(runId);
  }

  // Registers the promise and automatically removes the entry when it settles.
  track(runId: string, promise: Promise<void>): Promise<void> {
    const tracked = promise.finally(() => this.runs.delete(runId));
    this.runs.set(runId, tracked);

    return tracked;
  }

  drain(): Promise<void> {
    return Promise.allSettled(this.runs.values()).then(() => {});
  }
}
