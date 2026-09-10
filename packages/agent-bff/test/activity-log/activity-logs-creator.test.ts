import type { Logger } from '../../src/ports/logger-port';
import type { Context } from 'koa';

import { HttpError, NotFoundError } from '@forestadmin/forestadmin-client';

import ActivityLogDrainer from '../../src/activity-log/activity-log-drainer';
import createPendingActivityLog, {
  markActivityLog,
} from '../../src/activity-log/activity-logs-creator';
import {
  ACTIVITY_LOG_ID,
  ACTIVITY_LOG_INDEX,
  API_KEY_SERVER_TOKEN,
  RENDERING_ID,
  fakeActivityLogsService,
} from '../helpers/activity-log';

const RETRY_DELAY_MS = 500;
const MAX_ATTEMPTS = 5;

function ctxOf(): Context {
  return {
    state: {
      authMode: 'api-key',
      apiKeyIdentity: { renderingId: RENDERING_ID },
      resolveForestServerToken: async () => API_KEY_SERVER_TOKEN,
    },
  } as unknown as Context;
}

function loggerSpy(): jest.MockedFunction<Logger> {
  return jest.fn() as unknown as jest.MockedFunction<Logger>;
}

function pendingLog() {
  return {
    activityLog: { id: ACTIVITY_LOG_ID, attributes: { index: ACTIVITY_LOG_INDEX } },
    forestServerToken: API_KEY_SERVER_TOKEN,
  };
}

describe('activity logs creator', () => {
  describe('when the server accepts the creation but returns no id', () => {
    it('should serve a read unaudited and say the audit store dropped the write', async () => {
      const logger = loggerSpy();
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => ({ id: null })),
      });

      const pending = await createPendingActivityLog({
        ctx: ctxOf(),
        service,
        action: 'index',
        logger,
      });

      expect(pending).toBeNull();
      expect(logger).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('the audit store dropped the write'),
      );
    });

    it('should block an action, which must not run unaudited', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => ({ id: null })),
      });

      await expect(
        createPendingActivityLog({
          ctx: ctxOf(),
          service,
          action: 'action',
          context: { label: 'triggered the action "Refund"' },
          logger: loggerSpy(),
        }),
      ).rejects.toMatchObject({ status: 503, type: 'audit_unavailable' });
    });
  });

  describe('when the status transition lands before the document exists', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry and succeed once the document is there', async () => {
      const updateActivityLogStatus = jest
        .fn()
        .mockRejectedValueOnce(new NotFoundError())
        .mockResolvedValueOnce(undefined);
      const service = fakeActivityLogsService({ updateActivityLogStatus });
      const drainer = new ActivityLogDrainer();

      markActivityLog({
        service,
        drainer,
        pending: pendingLog(),
        status: 'completed',
        logger: loggerSpy(),
      });

      await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS);
      await drainer.drain();

      expect(updateActivityLogStatus).toHaveBeenCalledTimes(2);
      expect(updateActivityLogStatus).toHaveBeenLastCalledWith({
        forestServerToken: API_KEY_SERVER_TOKEN,
        activityLog: { id: ACTIVITY_LOG_ID, attributes: { index: ACTIVITY_LOG_INDEX } },
        status: 'completed',
      });
    });

    it('should give up after the last attempt and report the entry it could not mark', async () => {
      const updateActivityLogStatus = jest.fn().mockRejectedValue(new NotFoundError());
      const service = fakeActivityLogsService({ updateActivityLogStatus });
      const drainer = new ActivityLogDrainer();
      const logger = loggerSpy();

      markActivityLog({
        service,
        drainer,
        pending: pendingLog(),
        status: 'failed',
        logger,
      });

      await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS * MAX_ATTEMPTS);
      await drainer.drain();

      expect(updateActivityLogStatus).toHaveBeenCalledTimes(MAX_ATTEMPTS);
      expect(logger).toHaveBeenCalledWith(
        'Error',
        "Failed to mark the activity log as 'failed'",
        expect.objectContaining({ cause: 'NotFoundError: Not found' }),
      );
    });
  });

  describe('when the status transition fails for any other reason', () => {
    it('should report it without retrying, since a retry recovers nothing', async () => {
      const updateActivityLogStatus = jest
        .fn()
        .mockRejectedValue(new HttpError('the audit store is down', 500));
      const service = fakeActivityLogsService({ updateActivityLogStatus });
      const drainer = new ActivityLogDrainer();
      const logger = loggerSpy();

      markActivityLog({
        service,
        drainer,
        pending: pendingLog(),
        status: 'completed',
        logger,
      });

      await drainer.drain();

      expect(updateActivityLogStatus).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith(
        'Error',
        "Failed to mark the activity log as 'completed'",
        expect.objectContaining({ cause: 'HttpError: the audit store is down' }),
      );
    });
  });
});
