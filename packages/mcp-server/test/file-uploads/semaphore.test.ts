import createSemaphore from '../../src/file-uploads/semaphore';

const deferred = () => {
  let resolve: (value?: unknown) => void;
  let reject: (error: Error) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('createSemaphore', () => {
  it('runs a task and returns its value', async () => {
    await expect(createSemaphore(1)(async () => 'done')).resolves.toBe('done');
  });

  it('holds a task until a slot frees up', async () => {
    const run = createSemaphore(1);
    const first = deferred();
    let secondStarted = false;

    const firstCall = run(() => first.promise);
    const secondCall = run(async () => {
      secondStarted = true;
    });

    await Promise.resolve();
    expect(secondStarted).toBe(false);

    first.resolve();
    await firstCall;
    await secondCall;
    expect(secondStarted).toBe(true);
  });

  // Without the finally, a run of failures would exhaust the slots and hang every later task.
  it('frees the slot when a task rejects', async () => {
    const run = createSemaphore(2);

    await Promise.all(
      Array.from({ length: 5 }, () =>
        expect(
          run(async () => {
            throw new Error('boom');
          }),
        ).rejects.toThrow('boom'),
      ),
    );

    await expect(run(async () => 'still works')).resolves.toBe('still works');
  });

  it('surfaces the task rejection unchanged', async () => {
    await expect(
      createSemaphore(1)(async () => {
        throw new Error('storage is down');
      }),
    ).rejects.toThrow('storage is down');
  });

  it('never exceeds the limit under load', async () => {
    let active = 0;
    let peak = 0;
    const run = createSemaphore(3);

    await Promise.all(
      Array.from({ length: 20 }, () =>
        run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise(resolve => {
            setTimeout(resolve, 1);
          });
          active -= 1;
        }),
      ),
    );

    expect(peak).toBe(3);
    expect(active).toBe(0);
  });

  // One action submits every file reference at once, so the queue must absorb them all.
  it('serves a burst larger than the limit instead of refusing it', async () => {
    const run = createSemaphore(2);

    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => run(async () => i)));

    expect(results).toHaveLength(25);
  });
});
