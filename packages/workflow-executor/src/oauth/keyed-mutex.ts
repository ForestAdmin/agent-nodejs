// Serializes async work per key: callers sharing a key run one at a time (FIFO), while different
// keys proceed in parallel. Used to collapse concurrent token refreshes for the same (user, server)
// into a single in-flight refresh within one process.
export default class KeyedMutex {
  private readonly tails = new Map<string, Promise<unknown>>();

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(() => task());
    // Store a non-rejecting tail so the next caller chains regardless of this task's outcome.
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);

    try {
      return await result;
    } finally {
      // Drop the entry once this was the last queued task for the key, so the map can't grow.
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}
