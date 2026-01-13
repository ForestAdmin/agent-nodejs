import type { ForestServerClient } from '../../src/http-client';
import type { ActivityLogAction } from '../../src/utils/activity-logs-creator';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import { NotFoundError } from '@forestadmin/forestadmin-client';

import createPendingActivityLog, {
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

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action,
          type: expectedType,
        }),
      );
    });
  });

  describe('request formatting', () => {
    it('should call createActivityLog with forestServerToken from authInfo.extra', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'index');

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
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

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
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

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
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

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'users',
        }),
      );
    });

    it('should not include collectionName when not provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'index');

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
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

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
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

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
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

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
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

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 99,
          recordIds: [1, 2, 3],
        }),
      );
    });

    it('should include action name', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockForestServerClient, request, 'search');

      expect(mockForestServerClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'search',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should propagate error when createActivityLog fails', async () => {
      mockForestServerClient.createActivityLog.mockRejectedValue(
        new Error('Failed to create activity log: Server error message'),
      );

      const request = createMockRequest();

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'index'),
      ).rejects.toThrow('Failed to create activity log: Server error message');
    });

    it('should not throw when createActivityLog succeeds', async () => {
      const request = createMockRequest();

      await expect(
        createPendingActivityLog(mockForestServerClient, request, 'index'),
      ).resolves.not.toThrow();
    });
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

  it('should call updateActivityLogStatus with failed status and error message', async () => {
    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      forestServerClient: mockForestServerClient,
      request,
      activityLog,
      errorMessage: 'Something went wrong',
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
      errorMessage: 'Something went wrong',
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
      errorMessage: 'Something went wrong',
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
      errorMessage: 'Something went wrong',
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
      errorMessage: undefined,
    });

    jest.useRealTimers();
  });

  it('should not include errorMessage in completed status', async () => {
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
