export type RunExclusive = <T>(task: () => Promise<T>) => Promise<T>;

export default function createSemaphore(rawLimit: number): RunExclusive {
  // A limit below 1 would queue every task with nothing left to release it, hanging forever.
  const limit = Math.max(1, rawLimit);
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

    // The slot transfers to the waiting task, so active stays unchanged.
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
