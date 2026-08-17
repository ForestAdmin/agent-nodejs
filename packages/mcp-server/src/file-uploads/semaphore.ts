export type RunExclusive = <T>(task: () => Promise<T>) => Promise<T>;

export default function createSemaphore(limit: number): RunExclusive {
  let active = 0;
  const queue: Array<() => void> = [];

  // The queue is deliberately unbounded: one action submits all its file references at once, so a
  // cap would reject a form carrying more of them than the limit allows, every time. Each read is
  // bounded by downloadTimeoutSeconds instead, which is what keeps the queue draining.
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
