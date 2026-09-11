import ActivityLogDrainer from '../../src/activity-log/activity-log-drainer';

const stalled = () => new Promise<void>(() => {});

const TRANSITION = "'completed' transition of the activity log log-1";
const REQUEST = "'index' request on 'books'";

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
      TRANSITION,
    );

    await drainer.drain();

    expect(settled).toBe(true);
  });

  it('should wait for a rejected transition without rethrowing it', async () => {
    const drainer = new ActivityLogDrainer();

    const tracked = drainer.track(async () => {
      throw new Error('the audit store is down');
    }, TRANSITION);
    tracked.catch(() => undefined);

    await expect(drainer.drain()).resolves.toEqual([]);
  });

  it('should resolve immediately when nothing is in flight', async () => {
    const drainer = new ActivityLogDrainer();

    await expect(drainer.drain()).resolves.toEqual([]);
  });

  it('should return the tracked result to its caller', async () => {
    const drainer = new ActivityLogDrainer();

    await expect(drainer.track(async () => 'done', TRANSITION)).resolves.toBe('done');
  });

  it('should wait for work registered by an operation that was already in flight', async () => {
    const drainer = new ActivityLogDrainer();
    let transitionSettled = false;

    drainer.track(
      () =>
        new Promise<void>(resolveRequest => {
          setTimeout(() => {
            drainer.track(
              () =>
                new Promise<void>(resolveTransition => {
                  setTimeout(() => {
                    transitionSettled = true;
                    resolveTransition();
                  }, 10);
                }),
              TRANSITION,
            );
            resolveRequest();
          }, 10);
        }),
      REQUEST,
    );

    await drainer.drain();

    expect(transitionSettled).toBe(true);
  });

  describe('when a deadline is shared with the drain', () => {
    it('should return once it expires, naming what was still in flight', async () => {
      const drainer = new ActivityLogDrainer();

      drainer.track(stalled, TRANSITION);
      drainer.track(stalled, REQUEST);

      await expect(drainer.drain(20)).resolves.toEqual([TRANSITION, REQUEST]);
    });

    it('should return as soon as the work settles, well inside the deadline', async () => {
      const drainer = new ActivityLogDrainer();
      const startedAt = Date.now();

      drainer.track(
        () =>
          new Promise<void>(resolve => {
            setTimeout(resolve, 10);
          }),
        TRANSITION,
      );

      await expect(drainer.drain(10_000)).resolves.toEqual([]);
      expect(Date.now() - startedAt).toBeLessThan(5_000);
    });

    it('should give a stalled operation no grace at all once the deadline is spent', async () => {
      const drainer = new ActivityLogDrainer();

      drainer.track(stalled, TRANSITION);

      await expect(drainer.drain(0)).resolves.toEqual([TRANSITION]);
    });
  });
});
