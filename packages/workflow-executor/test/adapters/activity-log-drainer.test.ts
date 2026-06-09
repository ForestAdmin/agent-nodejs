import ActivityLogDrainer from '../../src/adapters/activity-log-drainer';

describe('ActivityLogDrainer', () => {
  it('drain() resolves immediately when nothing is in flight', async () => {
    const drainer = new ActivityLogDrainer();

    await expect(drainer.drain()).resolves.toBeUndefined();
  });

  it('drain() awaits all tracked promises before resolving', async () => {
    const drainer = new ActivityLogDrainer();
    let resolveWork!: () => void;

    drainer.track(
      () =>
        new Promise<void>(resolve => {
          resolveWork = resolve;
        }),
    );

    let drainResolved = false;
    const drainPromise = drainer.drain().then(() => {
      drainResolved = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(drainResolved).toBe(false);

    resolveWork();
    await drainPromise;
    expect(drainResolved).toBe(true);
  });

  it('removes promises from the in-flight set after they settle', async () => {
    const drainer = new ActivityLogDrainer();

    await drainer.track(async () => 'done');

    // If the promise stayed tracked, a second drain would wait forever; here it resolves instantly.
    await expect(drainer.drain()).resolves.toBeUndefined();
  });

  it('drain() resolves even when a tracked promise rejects (allSettled)', async () => {
    const drainer = new ActivityLogDrainer();

    // Attach a .catch() so the rejection is handled (no UnhandledPromiseRejection).
    drainer.track(async () => Promise.reject(new Error('boom'))).catch(() => {});

    await expect(drainer.drain()).resolves.toBeUndefined();
  });

  it('track() still rejects on the returned promise when the tracked fn throws', async () => {
    const drainer = new ActivityLogDrainer();

    await expect(
      drainer.track(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
