import type { ForestServerClient } from '../../src/http-client';
import type { ActivityLogAction } from '../../src/utils/activity-logs-creator';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { ForbiddenError, HttpError, NotFoundError } from '@forestadmin/forestadmin-client';

import createPendingActivityLog, {
  AUDIT_UNAVAILABLE_MESSAGE,
  markActivityLogAsFailed,
  markActivityLogAsSucceeded,
} from '../../src/utils/activity-logs-creator';
import createMockForestServerClient from '../helpers/forest-server-client';

describe('createPendingActivityLog', () => {
  let mockForestServerClient: jest.Mocked<ForestServerClient>;

  beforeEach(() => {
    mockForestServerClient = createMockForestServerClient();
  });

  const createMockRequest = (overrides = {}) =>
    ({
      authInfo: {
        extra: {
          forestServerToken: 'test-forest-token',
          renderingId: '12345',
          ...overrides,
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>);

  describe('action type mapping', () => {
    it.each<[ActivityLogAction, 'read' | 'write']>([
      ['index', 'read'],
      ['search', 'read'],
      ['filter', 'read'],
      ['listRelatedData', 'read'],
      ['describeCollection', 'read'],
      ['action', 'write'],
      ['create', 'write'],
      ['update', 'write'],
      ['delete', 'write'],
    ])('should map action "%s" to type "%s"', async (action, expectedType) => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, action);

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action,
          type: expectedType,
        }),
      );
    });
  });

  describe('request formatting', () => {
    it('should call createMcpActivityLog with forestServerToken from authInfo.extra', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'index');

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          forestServerToken: 'test-forest-token',
          renderingId: '12345',
        }),
      );
    });

    it('should use forestServerToken for Authorization (not the MCP token)', async () => {
      const request = {
        authInfo: {
          token: 'mcp-jwt-token-should-not-be-used',
          extra: {
            forestServerToken: 'original-forest-server-token',
            renderingId: '12345',
          },
        },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      await createPendingActivityLog(mockForestServerClient, request, 'index');

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          forestServerToken: 'original-forest-server-token',
        }),
      );
    });

    it('should throw error when forestServerToken is missing from extra', async () => {
      const request = {
        authInfo: {
          token: 'mcp-jwt-token',
          extra: {
            renderingId: '12345',
          },
        },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'index'),
      ).rejects.toThrow('Invalid or missing forestServerToken in authentication context');
    });

    it('should throw error when renderingId is missing from extra', async () => {
      const request = {
        authInfo: {
          token: 'mcp-jwt-token',
          extra: {
            forestServerToken: 'test-token',
            // renderingId is missing
          },
        },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'index'),
      ).rejects.toThrow('Invalid or missing renderingId in authentication context');
    });

    it('should accept numeric renderingId and convert to string', async () => {
      const request = {
        authInfo: {
          extra: {
            forestServerToken: 'test-token',
            renderingId: 456, // numeric renderingId from JWT
          },
        },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      await createPendingActivityLog(mockForestServerClient, request, 'index');

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          renderingId: '456', // should be converted to string
        }),
      );
    });

    it('should include collection name when provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'index', {
        collectionName: 'users',
      });

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'users',
        }),
      );
    });

    it('should not include collectionName when not provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'index');

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: undefined,
        }),
      );
    });

    it('should include label when provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'action', {
        label: 'Custom Action Label',
      });

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Custom Action Label',
        }),
      );
    });

    it('should include single recordId', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'update', {
        recordId: 42,
      });

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 42,
        }),
      );
    });

    it('should include multiple recordIds', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'delete', {
        recordIds: [1, 2, 3],
      });

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recordIds: [1, 2, 3],
        }),
      );
    });

    it('should include both recordId and recordIds when provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'delete', {
        recordId: 99,
        recordIds: [1, 2, 3],
      });

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 99,
          recordIds: [1, 2, 3],
        }),
      );
    });

    it('should include action name', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'search');

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'search',
        }),
      );
    });
  });

  describe('error handling', () => {
    it.each<ActivityLogAction>(['action', 'create', 'update', 'delete', 'triggerWorkflow'])(
      'should block write action "%s" and keep the server reason when createMcpActivityLog rejects (fail-closed)',
      async action => {
        mockForestServerClient.createMcpActivityLog.mockRejectedValue(
          new HttpError('collectionModelName is required', 400),
        );

        const request = createMockRequest();

        await expect(
          createPendingActivityLog(mockForestServerClient, request, action),
        ).rejects.toThrow('collectionModelName is required');
      },
    );

    // The blocked write is reported to a model, so a cause carrying the Forest server URL, an
    // internal host:port or a TLS chain must not travel with it - only the fixed sentence does,
    // and the cause goes to the operator log instead.
    it.each([
      ['a transport failure', new Error('connect ECONNREFUSED 10.0.0.4:5432')],
      [
        'a timeout',
        new HttpError('Timeout of 10000ms exceeded on https://api.forestadmin.com/liana', 408),
      ],
    ])('should replace %s with a sanitized message on a write', async (_label, error) => {
      mockForestServerClient.createMcpActivityLog.mockRejectedValue(error);

      const logger = jest.fn();
      const request = createMockRequest();

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'triggerWorkflow', { logger }),
      ).rejects.toThrow(AUDIT_UNAVAILABLE_MESSAGE);

      expect(logger).toHaveBeenCalledWith(
        'Error',
        `Activity log for 'triggerWorkflow' could not be created: ${(error as Error).message}`,
      );
    });

    it.each<ActivityLogAction>([
      'index',
      'search',
      'filter',
      'listRelatedData',
      'describeCollection',
    ])(
      'should resolve to null when createMcpActivityLog rejects for read action "%s" (fail-open)',
      async action => {
        mockForestServerClient.createMcpActivityLog.mockRejectedValue(
          new Error('Failed to create activity log: Server error message'),
        );

        const request = createMockRequest();

        await expect(
          createPendingActivityLog(mockForestServerClient, request, action),
        ).resolves.toBeNull();
      },
    );

    // Real HttpErrors rather than bare Errors: the status is what the fail policy now reads, so a
    // generic Error would make these labels describe a mode the code never sees.
    it.each([
      ['a 400 rejection (unresolvable collection)', new HttpError('Validation failed', 400)],
      ['a 5xx rejection (audit store unreachable)', new HttpError('Internal Server Error', 500)],
      ['a transport failure', new Error('connect ECONNREFUSED')],
    ])('should let a read through on %s', async (_label, error) => {
      mockForestServerClient.createMcpActivityLog.mockRejectedValue(error);

      const request = createMockRequest();

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'index'),
      ).resolves.toBeNull();
    });

    // An authorization refusal is not an audit outage: the caller's identity was rejected, so the
    // read it is about to perform is not authorized either. Fail-open must not swallow it.
    it.each([
      ['a 401 rejection', new HttpError('Unauthorized', 401)],
      ['a 403 rejection', new ForbiddenError('Forbidden')],
    ])('should propagate %s even for a read action', async (_label, error) => {
      mockForestServerClient.createMcpActivityLog.mockRejectedValue(error);

      const request = createMockRequest();

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'index'),
      ).rejects.toThrow(error);
    });

    it('should report the cause when a read proceeds unaudited', async () => {
      mockForestServerClient.createMcpActivityLog.mockRejectedValue(
        new HttpError('collectionModelName is required', 400),
      );

      const logger = jest.fn();
      const request = createMockRequest();

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'index', { logger }),
      ).resolves.toBeNull();

      expect(logger).toHaveBeenCalledWith(
        'Error',
        "Activity log for 'index' could not be created: collectionModelName is required",
      );
    });

    it('should report the cause when a read gets a 200 with no activity log id', async () => {
      mockForestServerClient.createMcpActivityLog.mockResolvedValue({ id: null } as never);

      const logger = jest.fn();
      const request = createMockRequest();

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'index', { logger }),
      ).resolves.toBeNull();

      expect(logger).toHaveBeenCalledWith(
        'Error',
        "Activity log for 'index' could not be created: the server answered 200 with no " +
          'activity log id, so the audit store dropped the write.',
      );
    });

    it('should never forward the logger to the server', async () => {
      mockForestServerClient.createMcpActivityLog.mockResolvedValue({ id: 'log-1' } as never);

      const logger = jest.fn();
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'index', { logger });

      expect(mockForestServerClient.createMcpActivityLog).toHaveBeenCalledWith(
        expect.not.objectContaining({ logger: expect.anything() }),
      );
    });

    it('should still throw an invalid-auth-context error for a read action', async () => {
      const request = {
        authInfo: { extra: { renderingId: '12345' } },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'index'),
      ).rejects.toThrow('Invalid or missing forestServerToken in authentication context');
      expect(mockForestServerClient.createMcpActivityLog).not.toHaveBeenCalled();
    });

    it('should not throw when createMcpActivityLog succeeds', async () => {
      const request = createMockRequest();

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'index'),
      ).resolves.not.toThrow();
    });

    it.each<ActivityLogAction>(['action', 'create', 'update', 'delete', 'triggerWorkflow'])(
      'should reject when the server returns a 200 with a null id for write action "%s" (fail-closed)',
      async action => {
        mockForestServerClient.createMcpActivityLog.mockResolvedValue({
          id: null,
          attributes: {},
        } as never);

        const request = createMockRequest();

        await expect(
          createPendingActivityLog(mockForestServerClient, request, action),
        ).rejects.toThrow(
          'Failed to create activity log: the server returned no activity log id. ' +
            'Blocking the operation to preserve the audit trail.',
        );
      },
    );

    it('should reject when the server returns a response with an undefined id for a write action (fail-closed)', async () => {
      mockForestServerClient.createMcpActivityLog.mockResolvedValue({
        attributes: {},
      } as never);

      const request = createMockRequest();

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'triggerWorkflow'),
      ).rejects.toThrow('the server returned no activity log id');
    });

    it.each<ActivityLogAction>([
      'index',
      'search',
      'filter',
      'listRelatedData',
      'describeCollection',
    ])(
      'should resolve to null when the server returns a 200 with a null id for read action "%s" (fail-open)',
      async action => {
        mockForestServerClient.createMcpActivityLog.mockResolvedValue({
          id: null,
          attributes: {},
        } as never);

        const request = createMockRequest();

        await expect(
          createPendingActivityLog(mockForestServerClient, request, action),
        ).resolves.toBeNull();
      },
    );
  });
});

describe('markActivityLogAsFailed', () => {
  let mockForestServerClient: jest.Mocked<ForestServerClient>;

  beforeEach(() => {
    mockForestServerClient = createMockForestServerClient();
  });

  function createMockRequest(): RequestHandlerExtra<ServerRequest, ServerNotification> {
    return {
      authInfo: {
        token: 'mock-token',
        clientId: 'mock-client-id',
        scopes: ['mcp:read'],
        extra: {
          forestServerToken: 'test-forest-token',
          renderingId: '12345',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;
  }

  it.each([
    ['a missing token', {}],
    ['a non-string token', { forestServerToken: 42 }],
    ['an empty token', { forestServerToken: '' }],
  ])('should skip the status update on %s rather than send an empty Bearer', async (_l, extra) => {
    const request = {
      authInfo: { token: 'mock-token', extra },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      forestServerClient: mockForestServerClient,
      request,
      activityLog,
      logger: mockLogger,
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    // An empty Bearer can only be refused, so the round trip is skipped entirely. (The retry
    // branch below is 404-only, so a 401 would not have been repeated — it would just have cost
    // one pointless call and an error log naming an auth failure rather than the missing token.)
    expect(mockForestServerClient.updateActivityLogStatus).not.toHaveBeenCalled();
    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      "Cannot update activity log status to 'failed': no forestServerToken in the auth context.",
    );
  });

  it('should call updateActivityLogStatus with failed status', async () => {
    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      forestServerClient: mockForestServerClient,
      request,
      activityLog,
      logger: mockLogger,
    });

    // Wait for the fire-and-forget promise to resolve
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledWith({
      forestServerToken: 'test-forest-token',
      activityLog,
      status: 'failed',
    });
  });

  it('should retry up to 5 times on NotFoundError', async () => {
    jest.useFakeTimers();

    const notFoundError = new NotFoundError('Activity log not found');
    mockForestServerClient.updateActivityLogStatus
      .mockRejectedValueOnce(notFoundError)
      .mockRejectedValueOnce(notFoundError)
      .mockRejectedValueOnce(notFoundError)
      .mockRejectedValueOnce(notFoundError)
      .mockResolvedValueOnce(undefined);

    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      forestServerClient: mockForestServerClient,
      request,
      activityLog,
      logger: mockLogger,
    });

    // Advance timers for all retries (4 retries * 500ms delay)
    await jest.advanceTimersByTimeAsync(4000);

    expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledTimes(5);
    expect(mockLogger).toHaveBeenCalledWith(
      'Debug',
      'Activity log not found (attempt 1/5), retrying...',
    );
    expect(mockLogger).toHaveBeenCalledWith(
      'Debug',
      'Activity log not found (attempt 4/5), retrying...',
    );

    jest.useRealTimers();
  });

  it('should stop retrying after 5 failed attempts and log error', async () => {
    jest.useFakeTimers();

    const notFoundError = new NotFoundError('Activity log not found');
    mockForestServerClient.updateActivityLogStatus.mockRejectedValue(notFoundError);

    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      forestServerClient: mockForestServerClient,
      request,
      activityLog,
      logger: mockLogger,
    });

    // Advance timers for all retries (4 retries * 500ms delay)
    await jest.advanceTimersByTimeAsync(4000);

    expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledTimes(5);
    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      "Failed to update activity log status to 'failed': Activity log not found",
    );

    jest.useRealTimers();
  });

  it('should not retry on non-404 errors', async () => {
    jest.useFakeTimers();

    const serverError = new Error('Internal server error');
    mockForestServerClient.updateActivityLogStatus.mockRejectedValue(serverError);

    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      forestServerClient: mockForestServerClient,
      request,
      activityLog,
      logger: mockLogger,
    });

    await jest.advanceTimersByTimeAsync(0);

    expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledTimes(1);
    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      "Failed to update activity log status to 'failed': Internal server error",
    );

    jest.useRealTimers();
  });
});

describe('markActivityLogAsSucceeded', () => {
  let mockForestServerClient: jest.Mocked<ForestServerClient>;

  beforeEach(() => {
    mockForestServerClient = createMockForestServerClient();
  });

  function createMockRequest(): RequestHandlerExtra<ServerRequest, ServerNotification> {
    return {
      authInfo: {
        token: 'mock-token',
        clientId: 'mock-client-id',
        scopes: ['mcp:read'],
        extra: {
          forestServerToken: 'test-forest-token',
          renderingId: '12345',
        },
      },
    } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;
  }

  it('should call updateActivityLogStatus with completed status', async () => {
    jest.useFakeTimers();

    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsSucceeded({
      forestServerClient: mockForestServerClient,
      request,
      activityLog,
      logger: mockLogger,
    });

    // Wait for the fire-and-forget promise to resolve
    await jest.advanceTimersByTimeAsync(0);

    expect(mockForestServerClient.updateActivityLogStatus).toHaveBeenCalledWith({
      forestServerToken: 'test-forest-token',
      activityLog,
      status: 'completed',
    });

    jest.useRealTimers();
  });
});
