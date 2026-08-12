export type RunExclusive = <T>(task: () => Promise<T>) => Promise<T>;

// Queueing beyond this is wasted work: each read is already bounded by downloadTimeoutSeconds, so
// the last waiter of a full queue would be answered around the point the calling client has given
// up anyway. Failing fast tells the model to retry instead of holding it.
const QUEUE_FACTOR = 2;

export default function createSemaphore(rawLimit: number): RunExclusive {
  // A limit below 1 would queue every task with nothing left to release it, hanging forever.
  const limit = Math.max(1, rawLimit);
  const maxQueued = limit * QUEUE_FACTOR;
  let active = 0;
  const queue: Array<() => void> = [];

  const acquire = () =>
    new Promise<void>((resolve, reject) => {
      if (active < limit) {
        active += 1;
        resolve();
      } else if (queue.length >= maxQueued) {
        reject(
          new Error(
            `Too many uploads are being read at once (${limit} in progress, ${queue.length} ` +
              'waiting). Retry in a moment.',
          ),
        );
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
