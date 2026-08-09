/**
 * Minimal counting semaphore, used to bound concurrent handle redemptions. Each
 * redemption can hold up to maxBytes plus its base64 copy in memory, so the process's
 * worst case stays bounded by maxBytes * limit instead of by whatever load arrives.
 */
export type RunExclusive = <T>(task: () => Promise<T>) => Promise<T>;

export default function createSemaphore(limit: number): RunExclusive {
  let active = 0;
  const queue: Array<() => void> = [];

  const acquire = () =>
    new Promise<void>(resolve => {
      if (active < limit) {
        active += 1;
        resolve();
      } else {
        queue.push(resolve);
      }
    });

  const release = () => {
    const next = queue.shift();

    // When a task is waiting, the slot transfers to it and active stays unchanged.
    if (next) next();
    else active -= 1;
  };

  return async <T>(task: () => Promise<T>): Promise<T> => {
    await acquire();

    try {
      return await task();
    } finally {
      release();
    }
  };
}
