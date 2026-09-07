import ActivityLogDrainer from '../../src/activity-log/activity-log-drainer';

describe('activity log drainer', () => {
  it('should wait for a tracked transition to settle', async () => {
    const drainer = new ActivityLogDrainer();
    let settled = false;

    drainer.track(
      () =>
        new Promise<void>(resolve => {
          setTimeout(() => {
            settled = true;
            resolve();
          }, 10);
        }),
    );

    await drainer.drain();

    expect(settled).toBe(true);
  });

  it('should wait for a rejected transition without rethrowing it', async () => {
    const drainer = new ActivityLogDrainer();

    const tracked = drainer.track(async () => {
      throw new Error('the audit store is down');
    });
    tracked.catch(() => undefined);

    await expect(drainer.drain()).resolves.toBeUndefined();
  });

  it('should resolve immediately when nothing is in flight', async () => {
    const drainer = new ActivityLogDrainer();

    await expect(drainer.drain()).resolves.toBeUndefined();
  });

  it('should return the tracked result to its caller', async () => {
    const drainer = new ActivityLogDrainer();

    await expect(drainer.track(async () => 'done')).resolves.toBe('done');
  });
});
