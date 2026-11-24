import type {
  ActivityLogContext,
  ActivityLogEntry,
} from '../../src/activity-log/with-activity-log';
import type { ActivityLogsServiceInterface } from '@forestadmin/forestadmin-client';

import { HttpError, NotFoundError } from '@forestadmin/forestadmin-client';

import withActivityLogContext, {
  drainActivityLogs,
  resolveEntry,
} from '../../src/activity-log/with-activity-log';
import {
  ActionRequiresApprovalError,
  ActivityLogBlockedError,
  ApprovalRequestCreationError,
} from '../../src/errors';

const ACTIVITY_LOG_ID = 'log-1';
const ACTIVITY_LOG_INDEX = 'activity-logs-2024';
const SERVER_TOKEN = 'server-token';
const RENDERING_ID = 42;
const RETRY_DELAY_MS = 500;
const MAX_ATTEMPTS = 5;

const READ: ActivityLogEntry = { action: 'index', collectionName: 'books' };
const WRITE: ActivityLogEntry = {
  action: 'action',
  collectionName: 'books',
  recordIds: ['1'],
  label: 'triggered the action "Refund"',
};

type FakeService = Record<keyof ActivityLogsServiceInterface, jest.Mock>;

function fakeService(overrides: Partial<FakeService> = {}): FakeService {
  return {
    createActivityLog: jest.fn(async () => ({
      id: ACTIVITY_LOG_ID,
      attributes: { index: ACTIVITY_LOG_INDEX },
    })),
    createMcpActivityLog: jest.fn(async () => ({
      id: ACTIVITY_LOG_ID,
      attributes: { index: ACTIVITY_LOG_INDEX },
    })),
    updateActivityLogStatus: jest.fn(async () => undefined),
    ...overrides,
  };
}

function rejectingService(error: unknown): FakeService {
  return fakeService({
    createMcpActivityLog: jest.fn(async () => {
      throw error;
    }),
  });
}

function contextOf(
  service: FakeService,
  overrides: Partial<ActivityLogContext> = {},
): ActivityLogContext {
  return {
    service: service as unknown as ActivityLogsServiceInterface,
    credentials: async () => ({ forestServerToken: SERVER_TOKEN, renderingId: RENDERING_ID }),
    logger: jest.fn(),
    ...overrides,
  };
}

function statusesOf(service: FakeService): string[] {
  return service.updateActivityLogStatus.mock.calls.map(([params]) => params.status);
}

describe('withActivityLogContext', () => {
  afterEach(async () => {
    await drainActivityLogs();
  });

  describe('when no context is given', () => {
    it('should run the operation and the hook without writing anything', async () => {
      const beforeCall = jest.fn(async () => undefined);

      await expect(
        withActivityLogContext(undefined, WRITE, async () => 'done', beforeCall),
      ).resolves.toBe('done');
      expect(beforeCall).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the entry is created', () => {
    it('should create the pending entry by collection name with the derived type', async () => {
      const service = fakeService();

      await withActivityLogContext(contextOf(service), WRITE, async () => 'done');

      expect(service.createMcpActivityLog).toHaveBeenCalledWith({
        forestServerToken: SERVER_TOKEN,
        renderingId: String(RENDERING_ID),
        action: 'action',
        type: 'write',
        collectionName: 'books',
        recordIds: ['1'],
        label: 'triggered the action "Refund"',
      });
    });

    it('should create the entry before the hook and the hook before the operation', async () => {
      const order: string[] = [];
      const service = fakeService({
        createMcpActivityLog: jest.fn(async () => {
          order.push('create');

          return { id: ACTIVITY_LOG_ID, attributes: { index: ACTIVITY_LOG_INDEX } };
        }),
      });

      await withActivityLogContext(
        contextOf(service),
        WRITE,
        async () => {
          order.push('operation');
        },
        async () => {
          order.push('beforeCall');
        },
      );

      expect(order).toEqual(['create', 'beforeCall', 'operation']);
    });

    it('should mark the entry completed when the operation succeeds', async () => {
      const service = fakeService();

      await withActivityLogContext(contextOf(service), READ, async () => 'done');
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).toHaveBeenCalledWith({
        forestServerToken: SERVER_TOKEN,
        activityLog: { id: ACTIVITY_LOG_ID, attributes: { index: ACTIVITY_LOG_INDEX } },
        status: 'completed',
      });
    });

    it('should mark the entry failed and rethrow when the operation fails', async () => {
      const service = fakeService();
      const failure = new Error('agent down');

      await expect(
        withActivityLogContext(contextOf(service), READ, async () => {
          throw failure;
        }),
      ).rejects.toBe(failure);
      await drainActivityLogs();

      expect(statusesOf(service)).toEqual(['failed']);
    });

    it('should mark the entry failed when the hook fails', async () => {
      const service = fakeService();
      const operation = jest.fn();

      await expect(
        withActivityLogContext(contextOf(service), WRITE, operation, async () => {
          throw new Error('marker not saved');
        }),
      ).rejects.toThrow('marker not saved');
      await drainActivityLogs();

      expect(operation).not.toHaveBeenCalled();
      expect(statusesOf(service)).toEqual(['failed']);
    });

    it('should mark the entry canceled when the result is an approval request', async () => {
      const service = fakeService();

      await withActivityLogContext(contextOf(service), WRITE, async () => ({
        approvalRequested: true as const,
        approvalRequest: { id: 'approval-1' },
      }));
      await drainActivityLogs();

      expect(statusesOf(service)).toEqual(['canceled']);
    });

    it('should mark a read completed when the record it returns says approvalRequested', async () => {
      const service = fakeService();

      await withActivityLogContext(contextOf(service), READ, async () => ({
        id: 1,
        approvalRequested: true,
      }));
      await drainActivityLogs();

      expect(statusesOf(service)).toEqual(['completed']);
    });

    it('should mark the entry canceled when the action requires an approval', async () => {
      const service = fakeService();

      await expect(
        withActivityLogContext(contextOf(service), WRITE, async () => {
          throw new ActionRequiresApprovalError('needs approval');
        }),
      ).rejects.toBeInstanceOf(ActionRequiresApprovalError);
      await drainActivityLogs();

      expect(statusesOf(service)).toEqual(['canceled']);
    });

    it('should mark the entry canceled when the approval request cannot be filed', async () => {
      const service = fakeService();

      await expect(
        withActivityLogContext(contextOf(service), WRITE, async () => {
          throw new ApprovalRequestCreationError(new Error('server down'));
        }),
      ).rejects.toBeInstanceOf(ApprovalRequestCreationError);
      await drainActivityLogs();

      expect(statusesOf(service)).toEqual(['canceled']);
    });

    it('should answer before the status transition settles', async () => {
      let releaseTransition: () => void = () => undefined;
      const service = fakeService({
        updateActivityLogStatus: jest.fn(
          () =>
            new Promise<void>(resolve => {
              releaseTransition = resolve;
            }),
        ),
      });

      await expect(
        withActivityLogContext(contextOf(service), READ, async () => 'done'),
      ).resolves.toBe('done');
      await expect(drainActivityLogs(10)).resolves.toEqual([
        `'completed' transition of the activity log ${ACTIVITY_LOG_ID}`,
      ]);

      releaseTransition();
    });
  });

  describe('when the context writes through the collection id route', () => {
    it('should resolve the collection id and send the workflow run', async () => {
      const service = fakeService();
      const workflow = { runId: 'run-1', name: 'Onboarding', stepName: 'Refund' };

      await withActivityLogContext(
        contextOf(service, { collectionIdOf: async name => `id-of-${name}`, workflow }),
        WRITE,
        async () => 'done',
      );

      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
      expect(service.createActivityLog).toHaveBeenCalledWith({
        forestServerToken: SERVER_TOKEN,
        renderingId: String(RENDERING_ID),
        action: 'action',
        type: 'write',
        collectionName: 'id-of-books',
        recordIds: ['1'],
        label: 'triggered the action "Refund"',
        workflow,
      });
    });
  });

  describe('when the collection id cannot be resolved', () => {
    const failure = new Error('collection lookup failed');
    const lookupContext = (service: FakeService) =>
      contextOf(service, {
        collectionIdOf: async () => {
          throw failure;
        },
      });

    it('should run a read unaudited', async () => {
      const service = fakeService();

      await expect(
        withActivityLogContext(lookupContext(service), READ, async () => 'done'),
      ).resolves.toBe('done');
      expect(service.createActivityLog).not.toHaveBeenCalled();
    });

    it('should block a write as unavailable, carrying the lookup error as its cause', async () => {
      const operation = jest.fn(async () => 'done');

      await expect(
        withActivityLogContext(lookupContext(fakeService()), WRITE, operation),
      ).rejects.toMatchObject({ reason: 'unavailable', cause: failure });
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('when the credentials cannot be resolved', () => {
    const failure = new Error('no token on this request');
    const unresolved = { credentials: async () => Promise.reject(failure) };

    it('should warn that the read ran without its activity log', async () => {
      const service = fakeService();
      const context = contextOf(service, unresolved);

      await withActivityLogContext(context, READ, async () => 'done');

      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        "Activity log for 'index' has no credentials to be created with, so the read ran without it",
        { collectionName: 'books', cause: 'Error: no token on this request' },
      );
    });

    it('should report as an error that the write was not performed', async () => {
      const context = contextOf(fakeService(), unresolved);

      await withActivityLogContext(context, WRITE, jest.fn()).catch(() => undefined);

      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        "Activity log for 'action' has no credentials to be created with, so the write was not performed",
        { collectionName: 'books', cause: 'Error: no token on this request' },
      );
    });

    it('should run a read unaudited', async () => {
      const service = fakeService();

      await expect(
        withActivityLogContext(contextOf(service, unresolved), READ, async () => 'done'),
      ).resolves.toBe('done');
      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });

    it('should block a write, carrying the resolution error as its cause', async () => {
      const operation = jest.fn();

      await expect(
        withActivityLogContext(contextOf(fakeService(), unresolved), WRITE, operation),
      ).rejects.toMatchObject({ reason: 'unavailable', cause: failure });
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('when the server accepts the creation but returns no id', () => {
    const noId = () => fakeService({ createMcpActivityLog: jest.fn(async () => ({ id: null })) });

    it('should run a read unaudited and warn that it ran without its activity log', async () => {
      const service = noId();
      const context = contextOf(service);

      await expect(withActivityLogContext(context, READ, async () => 'done')).resolves.toBe('done');
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).not.toHaveBeenCalled();
      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        "Activity log for 'index' could not be created: the server answered with no activity " +
          'log id or index, so the read ran without it',
        { renderingId: RENDERING_ID, collectionName: 'books' },
      );
    });

    it('should report as an error that the write was not performed', async () => {
      const context = contextOf(noId());

      await withActivityLogContext(context, WRITE, jest.fn()).catch(() => undefined);

      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        "Activity log for 'action' could not be created: the server answered with no activity " +
          'log id or index, so the write was not performed',
        { renderingId: RENDERING_ID, collectionName: 'books' },
      );
    });

    it('should block a write, which must not run unaudited', async () => {
      const operation = jest.fn();

      await expect(
        withActivityLogContext(contextOf(noId()), WRITE, operation),
      ).rejects.toMatchObject({
        reason: 'dropped',
      });
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('when the server answers without an index or with empty values', () => {
    it.each([
      ['no index', { id: ACTIVITY_LOG_ID }],
      ['an empty id', { id: '', attributes: { index: ACTIVITY_LOG_INDEX } }],
      ['an empty index', { id: ACTIVITY_LOG_ID, attributes: { index: '' } }],
    ])('should block a write on %s', async (_, answer) => {
      const service = fakeService({ createMcpActivityLog: jest.fn(async () => answer) });

      await expect(
        withActivityLogContext(contextOf(service), WRITE, async () => 'done'),
      ).rejects.toMatchObject({ reason: 'dropped' });
    });

    it('should run a read rather than track an entry it cannot transition', async () => {
      const service = fakeService({
        createMcpActivityLog: jest.fn(async () => ({ id: '', attributes: { index: '' } })),
      });

      await expect(
        withActivityLogContext(contextOf(service), READ, async () => 'done'),
      ).resolves.toBe('done');
    });
  });

  describe('when the server does not expose the activity log endpoint', () => {
    it.each([
      ['a 404', new NotFoundError()],
      ['a 501', new HttpError('not implemented', 501)],
    ])('should block a write as endpointAbsent on %s', async (_, error) => {
      await expect(
        withActivityLogContext(contextOf(rejectingService(error)), WRITE, async () => 'done'),
      ).rejects.toMatchObject({ reason: 'endpointAbsent', cause: error });
    });

    it('should block a write as unavailable when the endpoint answered with a failure', async () => {
      await expect(
        withActivityLogContext(
          contextOf(rejectingService(new HttpError('the audit store is down', 500))),
          WRITE,
          async () => 'done',
        ),
      ).rejects.toMatchObject({ reason: 'unavailable' });
    });

    it('should run a read unaudited rather than refuse it', async () => {
      await expect(
        withActivityLogContext(
          contextOf(rejectingService(new NotFoundError())),
          READ,
          async () => 'done',
        ),
      ).resolves.toBe('done');
    });

    it('should warn that the read ran without its activity log', async () => {
      const context = contextOf(rejectingService(new HttpError('the audit store is down', 500)));

      await withActivityLogContext(context, READ, async () => 'done');

      expect(context.logger).toHaveBeenCalledWith(
        'Warn',
        "Activity log for 'index' could not be created, so the read ran without it",
        {
          renderingId: RENDERING_ID,
          collectionName: 'books',
          cause: 'HttpError: the audit store is down',
        },
      );
    });

    it('should report as an error that the write was not performed', async () => {
      const context = contextOf(rejectingService(new HttpError('the audit store is down', 500)));

      await withActivityLogContext(context, WRITE, jest.fn()).catch(() => undefined);

      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        "Activity log for 'action' could not be created, so the write was not performed",
        {
          renderingId: RENDERING_ID,
          collectionName: 'books',
          cause: 'HttpError: the audit store is down',
        },
      );
    });
  });

  describe('when the server refuses the creation with a 403', () => {
    it('should refuse a read too, which is not authorized either', async () => {
      const operation = jest.fn();

      await expect(
        withActivityLogContext(
          contextOf(rejectingService(new HttpError('forbidden', 403))),
          READ,
          operation,
        ),
      ).rejects.toMatchObject({ reason: 'notAuthorized' });
      expect(operation).not.toHaveBeenCalled();
    });

    it('should report the refused read as an error', async () => {
      const context = contextOf(rejectingService(new HttpError('forbidden', 403)));

      await withActivityLogContext(context, READ, jest.fn()).catch(() => undefined);

      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        "Activity log for 'index' could not be created",
        { renderingId: RENDERING_ID, collectionName: 'books', cause: 'HttpError: forbidden' },
      );
    });

    it('should keep the cached credential', async () => {
      const onExpiredCredential = jest.fn();

      await withActivityLogContext(
        contextOf(rejectingService(new HttpError('forbidden', 403)), { onExpiredCredential }),
        READ,
        async () => 'done',
      ).catch(() => undefined);

      expect(onExpiredCredential).not.toHaveBeenCalled();
    });
  });

  describe('when the server refuses the creation with a 401', () => {
    const expired = () => rejectingService(new HttpError('expired', 401));

    describe('for a consumer whose credential renews', () => {
      it('should run a read unaudited and drop the cached credential', async () => {
        const onExpiredCredential = jest.fn();

        await expect(
          withActivityLogContext(
            contextOf(expired(), { onExpiredCredential }),
            READ,
            async () => 'done',
          ),
        ).resolves.toBe('done');
        expect(onExpiredCredential).toHaveBeenCalledTimes(1);
      });

      it('should block a write as unavailable, not as not authorized', async () => {
        await expect(
          withActivityLogContext(
            contextOf(expired(), { onExpiredCredential: jest.fn() }),
            WRITE,
            async () => 'done',
          ),
        ).rejects.toMatchObject({ reason: 'unavailable' });
      });
    });

    describe('for a consumer whose credential does not renew', () => {
      it('should refuse a read as not authorized', async () => {
        await expect(
          withActivityLogContext(contextOf(expired()), READ, async () => 'done'),
        ).rejects.toMatchObject({ reason: 'notAuthorized' });
      });

      it('should report the refused read as an error', async () => {
        const context = contextOf(expired());

        await withActivityLogContext(context, READ, jest.fn()).catch(() => undefined);

        expect(context.logger).toHaveBeenCalledWith(
          'Error',
          "Activity log for 'index' could not be created",
          { renderingId: RENDERING_ID, collectionName: 'books', cause: 'HttpError: expired' },
        );
      });
    });
  });

  describe('when the creation fails for a transient reason', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry it when the consumer asks for it', async () => {
      const service = fakeService({
        createMcpActivityLog: jest
          .fn()
          .mockRejectedValueOnce(new HttpError('busy', 503))
          .mockResolvedValueOnce({
            id: ACTIVITY_LOG_ID,
            attributes: { index: ACTIVITY_LOG_INDEX },
          }),
      });

      const run = withActivityLogContext(
        contextOf(service, { retryCreation: true }),
        WRITE,
        async () => 'done',
      );
      await jest.advanceTimersByTimeAsync(100);

      await expect(run).resolves.toBe('done');
      expect(service.createMcpActivityLog).toHaveBeenCalledTimes(2);
    });

    it('should give up after the last retry and block the write', async () => {
      const service = rejectingService(new HttpError('busy', 503));

      const run = withActivityLogContext(
        contextOf(service, { retryCreation: true }),
        WRITE,
        async () => 'done',
      );
      run.catch(() => undefined);
      await jest.advanceTimersByTimeAsync(2_600);

      await expect(run).rejects.toMatchObject({ reason: 'unavailable' });
      expect(service.createMcpActivityLog).toHaveBeenCalledTimes(4);
    });

    it('should not retry a refused creation, and block the write as not authorized', async () => {
      const service = rejectingService(new HttpError('forbidden', 403));

      await expect(
        withActivityLogContext(
          contextOf(service, { retryCreation: true }),
          WRITE,
          async () => 'done',
        ),
      ).rejects.toMatchObject({ reason: 'notAuthorized' });
      expect(service.createMcpActivityLog).toHaveBeenCalledTimes(1);
    });

    it('should not retry it otherwise', async () => {
      const service = rejectingService(new HttpError('busy', 503));

      await expect(
        withActivityLogContext(contextOf(service), WRITE, async () => 'done'),
      ).rejects.toBeInstanceOf(ActivityLogBlockedError);
      expect(service.createMcpActivityLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the status transition lands before the document exists', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    it('should retry and succeed once the document is there', async () => {
      const service = fakeService({
        updateActivityLogStatus: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError())
          .mockResolvedValueOnce(undefined),
      });

      await withActivityLogContext(contextOf(service), READ, async () => 'done');
      await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS);
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).toHaveBeenCalledTimes(2);
    });

    it('should not let the wait it schedules keep the event loop alive', async () => {
      const scheduleTimer = global.setTimeout;
      const handles: Array<{ unref: jest.Mock }> = [];
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(((
        callback: () => void,
        delay: number,
      ) => {
        scheduleTimer(callback, delay);
        const handle = { unref: jest.fn() };
        handles.push(handle);

        return handle;
      }) as unknown as typeof global.setTimeout);
      const service = fakeService({
        updateActivityLogStatus: jest
          .fn()
          .mockRejectedValueOnce(new NotFoundError())
          .mockResolvedValueOnce(undefined),
      });

      await withActivityLogContext(contextOf(service), READ, async () => 'done');
      await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS);
      await drainActivityLogs();

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), RETRY_DELAY_MS);
      expect(handles[0].unref).toHaveBeenCalledTimes(1);
    });

    it('should give up after the last attempt and report the entry it could not mark', async () => {
      const service = fakeService({
        updateActivityLogStatus: jest.fn().mockRejectedValue(new NotFoundError()),
      });
      const context = contextOf(service);

      await withActivityLogContext(context, READ, async () => {
        throw new Error('agent down');
      }).catch(() => undefined);
      await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS * MAX_ATTEMPTS);
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).toHaveBeenCalledTimes(MAX_ATTEMPTS);
      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        "Failed to mark the activity log as 'failed'",
        {
          activityLogId: ACTIVITY_LOG_ID,
          index: ACTIVITY_LOG_INDEX,
          cause: 'NotFoundError: Not found',
        },
      );
    });
  });

  describe('when the status transition fails for a transient reason', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([
      ['a 500', new HttpError('the audit store is down', 500)],
      ['a 408', new HttpError('timeout', 408)],
      ['a 429', new HttpError('throttled', 429)],
      ['an unreachable server', new HttpError('unreachable', 0)],
      ['a transport failure carrying no status', new Error('connect ECONNREFUSED')],
    ])('should retry %s', async (_, error) => {
      const service = fakeService({
        updateActivityLogStatus: jest
          .fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(undefined),
      });

      await withActivityLogContext(contextOf(service), READ, async () => 'done');
      await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS);
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the status transition is refused', () => {
    it('should report it without retrying, since a retry recovers nothing', async () => {
      const service = fakeService({
        updateActivityLogStatus: jest
          .fn()
          .mockRejectedValue(new HttpError('this token may not write that log', 403)),
      });
      const context = contextOf(service);

      await withActivityLogContext(context, READ, async () => 'done');
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).toHaveBeenCalledTimes(1);
      expect(context.logger).toHaveBeenCalledWith(
        'Error',
        "Failed to mark the activity log as 'completed'",
        {
          activityLogId: ACTIVITY_LOG_ID,
          index: ACTIVITY_LOG_INDEX,
          cause: 'HttpError: this token may not write that log',
        },
      );
    });
  });

  describe('drainActivityLogs', () => {
    it('should name an audited operation still running when the deadline expires', async () => {
      let finish: () => void = () => undefined;

      const running = withActivityLogContext(
        contextOf(fakeService()),
        READ,
        () =>
          new Promise<void>(resolve => {
            finish = resolve;
          }),
      );

      await expect(drainActivityLogs(20)).resolves.toEqual(["'index' request on 'books'"]);

      finish();
      await running;
    });
  });
});

describe('resolveEntry', () => {
  it('should keep the derived entry when the call says nothing', () => {
    expect(resolveEntry({ action: 'index', collectionName: 'books' })).toEqual({
      action: 'index',
      collectionName: 'books',
      label: undefined,
    });
  });

  it('should let the call name the entry and its label', () => {
    expect(
      resolveEntry(
        { action: 'index', collectionName: 'books', recordIds: ['1'] },
        { action: 'listRelatedData', label: 'list relation "Author"' },
      ),
    ).toEqual({
      action: 'listRelatedData',
      collectionName: 'books',
      recordIds: ['1'],
      label: 'list relation "Author"',
    });
  });

  it('should open no entry for an operation that has none unless the call names one', () => {
    expect(resolveEntry({ collectionName: 'books' })).toBeNull();
    expect(resolveEntry({ collectionName: 'books' }, { action: 'describeCollection' })).toEqual({
      action: 'describeCollection',
      collectionName: 'books',
      label: undefined,
    });
  });
});
