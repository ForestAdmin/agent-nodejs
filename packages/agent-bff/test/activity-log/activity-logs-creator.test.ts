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

function ctxOf(invalidateApiKeyIdentity: () => void = () => undefined): Context {
  return {
    state: {
      authMode: 'api-key',
      apiKeyIdentity: { renderingId: RENDERING_ID },
      resolveForestServerToken: async () => API_KEY_SERVER_TOKEN,
      invalidateApiKeyIdentity,
    },
  } as unknown as Context;
}

function ctxWithoutCredentials(): Context {
  return {
    state: {
      authMode: 'api-key',
      apiKeyIdentity: { renderingId: RENDERING_ID },
      resolveForestServerToken: async () => {
        throw new Error('no token on this request');
      },
    },
  } as unknown as Context;
}

function rejectingService(error: unknown) {
  return fakeActivityLogsService({
    createMcpActivityLog: jest.fn(async () => {
      throw error;
    }),
  });
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
  describe('when the credentials cannot be resolved', () => {
    it('should name the rendering the request carries', async () => {
      const logger = loggerSpy();

      await createPendingActivityLog({
        ctx: ctxWithoutCredentials(),
        service: fakeActivityLogsService(),
        action: 'index',
        context: { collectionName: 'books' },
        logger,
      });

      expect(logger).toHaveBeenCalledWith(
        'Error',
        "Activity log for 'index' has no credentials to be created with",
        {
          renderingId: RENDERING_ID,
          collectionName: 'books',
          cause: 'Error: no token on this request',
        },
      );
    });
  });

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
        context: { collectionName: 'books' },
        logger,
      });

      expect(pending).toBeNull();
      expect(logger).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('the audit store dropped the write'),
        { renderingId: RENDERING_ID, collectionName: 'books' },
      );
    });

    it('should block an action, which must not run unaudited, and record why', async () => {
      const logger = loggerSpy();
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => ({ id: null })),
      });

      await expect(
        createPendingActivityLog({
          ctx: ctxOf(),
          service,
          action: 'action',
          context: { collectionName: 'books', label: 'triggered the action "Refund"' },
          logger,
        }),
      ).rejects.toMatchObject({ status: 503, type: 'audit_unavailable' });

      expect(logger).toHaveBeenCalledWith(
        'Error',
        expect.stringContaining('the audit store dropped the write'),
        { renderingId: RENDERING_ID, collectionName: 'books' },
      );
    });
  });

  describe('when the server accepts the creation but returns no index', () => {
    it('should serve a read unaudited, since the status transition could never land', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => ({ id: ACTIVITY_LOG_ID })),
      });

      const pending = await createPendingActivityLog({
        ctx: ctxOf(),
        service,
        action: 'index',
        logger: loggerSpy(),
      });

      expect(pending).toBeNull();
    });

    it('should block an action instead of stranding its entry pending', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => ({ id: ACTIVITY_LOG_ID })),
      });

      await expect(
        createPendingActivityLog({
          ctx: ctxOf(),
          service,
          action: 'action',
          logger: loggerSpy(),
        }),
      ).rejects.toMatchObject({ status: 503, type: 'audit_unavailable' });
    });
  });

  describe('when the server refuses the creation with a 403', () => {
    it('should refuse a read too, which is not authorized either', async () => {
      const service = rejectingService(new HttpError('forbidden', 403));

      await expect(
        createPendingActivityLog({
          ctx: ctxOf(),
          service,
          action: 'index',
          logger: loggerSpy(),
        }),
      ).rejects.toMatchObject({ status: 403, type: 'audit_not_authorized' });
    });
  });

  describe('when the server refuses the creation with a 401', () => {
    it('should serve a read unaudited rather than refuse it', async () => {
      const service = rejectingService(new HttpError('expired', 401));

      const pending = await createPendingActivityLog({
        ctx: ctxOf(),
        service,
        action: 'index',
        logger: loggerSpy(),
      });

      expect(pending).toBeNull();
    });

    it('should block an action with audit_unavailable, not audit_not_authorized', async () => {
      const service = rejectingService(new HttpError('expired', 401));
      const logger = loggerSpy();

      await expect(
        createPendingActivityLog({ ctx: ctxOf(), service, action: 'action', logger }),
      ).rejects.toMatchObject({ status: 503, type: 'audit_unavailable' });

      expect(logger).toHaveBeenCalledWith(
        'Error',
        "Activity log for 'action' could not be created",
        { renderingId: RENDERING_ID, cause: 'HttpError: expired' },
      );
    });

    it('should drop the cached identity so the next request re-resolves the key', async () => {
      const invalidateApiKeyIdentity = jest.fn();
      const service = rejectingService(new HttpError('expired', 401));

      await createPendingActivityLog({
        ctx: ctxOf(invalidateApiKeyIdentity),
        service,
        action: 'index',
        logger: loggerSpy(),
      });

      expect(invalidateApiKeyIdentity).toHaveBeenCalledTimes(1);
    });

    it('should keep the cached identity when the refusal is a 403', async () => {
      const invalidateApiKeyIdentity = jest.fn();
      const service = rejectingService(new HttpError('forbidden', 403));

      await createPendingActivityLog({
        ctx: ctxOf(invalidateApiKeyIdentity),
        service,
        action: 'index',
        logger: loggerSpy(),
      }).catch(() => undefined);

      expect(invalidateApiKeyIdentity).not.toHaveBeenCalled();
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
      expect(logger).toHaveBeenCalledWith('Error', "Failed to mark the activity log as 'failed'", {
        activityLogId: ACTIVITY_LOG_ID,
        index: ACTIVITY_LOG_INDEX,
        cause: 'NotFoundError: Not found',
      });
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
        {
          activityLogId: ACTIVITY_LOG_ID,
          index: ACTIVITY_LOG_INDEX,
          cause: 'HttpError: the audit store is down',
        },
      );
    });
  });
});
