import type { ActivityLogsServiceInterface } from '@forestadmin/forestadmin-client';

import ActivityLogDrainer from '../../src/adapters/activity-log-drainer';
import ForestadminClientActivityLogPort from '../../src/adapters/forestadmin-client-activity-log-port';
import { ActivityLogCreationError } from '../../src/errors';

function makeLogger() {
  return { info: jest.fn(), error: jest.fn() };
}

function makeService(): jest.Mocked<ActivityLogsServiceInterface> {
  return {
    createActivityLog: jest.fn(),
    updateActivityLogStatus: jest.fn(),
  };
}

function makeHttpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function makePort(
  service: ActivityLogsServiceInterface,
  overrides: {
    logger?: ReturnType<typeof makeLogger>;
    token?: string;
    drainer?: ActivityLogDrainer;
  } = {},
) {
  return new ForestadminClientActivityLogPort(
    service,
    overrides.logger ?? makeLogger(),
    overrides.token ?? 'tok',
    overrides.drainer ?? new ActivityLogDrainer(),
  );
}

describe('ForestadminClientActivityLogPort', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createPending', () => {
    it('returns handle on first-attempt success without retry', async () => {
      const service = makeService();
      service.createActivityLog.mockResolvedValue({
        id: 'log-1',
        attributes: { index: '0' },
      });
      const port = makePort(service);

      const handle = await port.createPending({ renderingId: 5, action: 'update', type: 'write' });

      expect(handle).toEqual({ id: 'log-1', index: '0' });
      expect(service.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ forestServerToken: 'tok', renderingId: '5', action: 'update' }),
      );
      expect(service.createActivityLog).toHaveBeenCalledTimes(1);
    });

    it('retries on 503 and succeeds on the second attempt', async () => {
      const service = makeService();
      service.createActivityLog
        .mockRejectedValueOnce(makeHttpError(503))
        .mockResolvedValueOnce({ id: 'log-2', attributes: { index: '1' } });
      const logger = makeLogger();
      const port = makePort(service, { logger });

      const promise = port.createPending({ renderingId: 5, action: 'update', type: 'write' });
      await jest.advanceTimersByTimeAsync(100);
      const handle = await promise;

      expect(handle).toEqual({ id: 'log-2', index: '1' });
      expect(service.createActivityLog).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('createPending'),
        expect.objectContaining({ attempt: 1 }),
      );
    });

    it('throws ActivityLogCreationError after all retries are exhausted', async () => {
      const service = makeService();
      service.createActivityLog.mockRejectedValue(makeHttpError(502));
      const port = makePort(service);

      const promise = port.createPending({ renderingId: 5, action: 'update', type: 'write' });
      const settled = promise.catch(err => err);
      await jest.advanceTimersByTimeAsync(2_600);
      const err = await settled;

      expect(err).toBeInstanceOf(ActivityLogCreationError);
      expect(service.createActivityLog).toHaveBeenCalledTimes(4);
    });

    it('does not retry on 401 (not a transient error)', async () => {
      const service = makeService();
      service.createActivityLog.mockRejectedValue(makeHttpError(401));
      const port = makePort(service);

      await expect(
        port.createPending({ renderingId: 5, action: 'update', type: 'write' }),
      ).rejects.toBeInstanceOf(ActivityLogCreationError);
      expect(service.createActivityLog).toHaveBeenCalledTimes(1);
    });

    it('retries on network error (TypeError from fetch)', async () => {
      const service = makeService();
      const networkErr = new TypeError('fetch failed');
      service.createActivityLog
        .mockRejectedValueOnce(networkErr)
        .mockResolvedValueOnce({ id: 'log-3', attributes: { index: '2' } });
      const port = makePort(service);

      const promise = port.createPending({ renderingId: 5, action: 'update', type: 'write' });
      await jest.advanceTimersByTimeAsync(100);
      await expect(promise).resolves.toEqual({ id: 'log-3', index: '2' });
    });

    it('converts numeric renderingId to string for the Forest API', async () => {
      const service = makeService();
      service.createActivityLog.mockResolvedValue({
        id: 'log-4',
        attributes: { index: '3' },
      });
      const port = makePort(service);

      await port.createPending({ renderingId: 42, action: 'update', type: 'write' });

      expect(service.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ renderingId: '42' }),
      );
    });
  });

  describe('markSucceeded', () => {
    it('retries on 503 and eventually resolves without rethrowing', async () => {
      const service = makeService();
      service.updateActivityLogStatus
        .mockRejectedValueOnce(makeHttpError(503))
        .mockResolvedValueOnce(undefined);
      const port = makePort(service);

      const promise = port.markSucceeded({ id: 'log-1', index: '0' });
      await jest.advanceTimersByTimeAsync(100);
      await expect(promise).resolves.toBeUndefined();
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed', forestServerToken: 'tok' }),
      );
    });

    it('swallows errors after retries are exhausted (fire-and-forget)', async () => {
      const service = makeService();
      service.updateActivityLogStatus.mockRejectedValue(makeHttpError(503));
      const logger = makeLogger();
      const port = makePort(service, { logger });

      const promise = port.markSucceeded({ id: 'log-1', index: '0' });
      await jest.advanceTimersByTimeAsync(2_600);
      await expect(promise).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('markSucceeded failed'),
        expect.objectContaining({ handleId: 'log-1' }),
      );
    });
  });

  describe('markFailed', () => {
    it('forwards the errorMessage and retries on 503', async () => {
      const service = makeService();
      service.updateActivityLogStatus
        .mockRejectedValueOnce(makeHttpError(503))
        .mockResolvedValueOnce(undefined);
      const port = makePort(service);

      const promise = port.markFailed({ id: 'log-1', index: '0' }, 'boom');
      await jest.advanceTimersByTimeAsync(100);
      await promise;

      expect(service.updateActivityLogStatus).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'boom',
          forestServerToken: 'tok',
        }),
      );
    });
  });

  describe('drainer integration', () => {
    it('registers markSucceeded in the shared drainer for drain() to await', async () => {
      const service = makeService();
      let resolveUpdate!: () => void;
      service.updateActivityLogStatus.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveUpdate = resolve;
          }),
      );
      const drainer = new ActivityLogDrainer();
      const port = makePort(service, { drainer });

      const markPromise = port.markSucceeded({ id: 'log-1', index: '0' });

      let drainResolved = false;
      const drainPromise = drainer.drain().then(() => {
        drainResolved = true;
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(drainResolved).toBe(false);

      resolveUpdate();
      await markPromise;
      await drainPromise;
      expect(drainResolved).toBe(true);
    });
  });
});
