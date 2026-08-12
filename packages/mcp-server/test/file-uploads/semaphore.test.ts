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

  it.each([[0], [-1]])('treats a limit of %p as 1 rather than hanging forever', async limit => {
    const run = createSemaphore(limit);

    await expect(run(async () => 'ran')).resolves.toBe('ran');
    await expect(run(async () => 'ran again')).resolves.toBe('ran again');
  });

  it('never exceeds the limit under load', async () => {
    let active = 0;
    let peak = 0;
    const run = createSemaphore(3);

    // 3 running plus a full queue of 6 — the most the semaphore accepts at once.
    await Promise.all(
      Array.from({ length: 9 }, () =>
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

  // Waiting longer than the caller's own timeout is wasted work, so the queue is bounded.
  it('refuses work once the queue is full instead of growing it', async () => {
    const run = createSemaphore(2);
    const blocker = new Promise(resolve => {
      setTimeout(resolve, 50);
    });

    const accepted = Array.from({ length: 6 }, () => run(() => blocker));
    const overflow = run(async () => 'never runs');

    await expect(overflow).rejects.toThrow('Too many uploads are being read at once');
    await Promise.all(accepted);
  });

  it('accepts work again once the queue drains', async () => {
    const run = createSemaphore(1);

    await Promise.all(Array.from({ length: 3 }, () => run(async () => 'done')));

    await expect(run(async () => 'later')).resolves.toBe('later');
  });
});
