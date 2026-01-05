import type { McpHttpClient } from '../../src/http-client';
import type { ActivityLogAction } from '../../src/utils/activity-logs-creator';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import createPendingActivityLog, {
  markActivityLogAsFailed,
  markActivityLogAsSucceeded,
} from '../../src/utils/activity-logs-creator';
import createMockHttpClient from '../helpers/mcp-http-client';

describe('createPendingActivityLog', () => {
  let mockHttpClient: jest.Mocked<McpHttpClient>;

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
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

      await createPendingActivityLog(mockHttpClient, request, action);

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
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

      await createPendingActivityLog(mockHttpClient, request, 'index');

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
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

      await createPendingActivityLog(mockHttpClient, request, 'index');

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          forestServerToken: 'original-forest-server-token',
        }),
      );
    });

    it('should send undefined token when forestServerToken is missing from extra', async () => {
      const request = {
        authInfo: {
          token: 'mcp-jwt-token',
          extra: {
            renderingId: '12345',
          },
        },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      await createPendingActivityLog(mockHttpClient, request, 'index');

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          forestServerToken: undefined,
        }),
      );
    });

    it('should include collection name when provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockHttpClient, request, 'index', {
        collectionName: 'users',
      });

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: 'users',
        }),
      );
    });

    it('should not include collectionName when not provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockHttpClient, request, 'index');

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionName: undefined,
        }),
      );
    });

    it('should include label when provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockHttpClient, request, 'action', {
        label: 'Custom Action Label',
      });

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'Custom Action Label',
        }),
      );
    });

    it('should include single recordId', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockHttpClient, request, 'update', {
        recordId: 42,
      });

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 42,
        }),
      );
    });

    it('should include multiple recordIds', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockHttpClient, request, 'delete', {
        recordIds: [1, 2, 3],
      });

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recordIds: [1, 2, 3],
        }),
      );
    });

    it('should include both recordId and recordIds when provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockHttpClient, request, 'delete', {
        recordId: 99,
        recordIds: [1, 2, 3],
      });

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: 99,
          recordIds: [1, 2, 3],
        }),
      );
    });

    it('should include action name', async () => {
      const request = createMockRequest();

      await createPendingActivityLog(mockHttpClient, request, 'search');

      expect(mockHttpClient.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'search',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should propagate error when createActivityLog fails', async () => {
      mockHttpClient.createActivityLog.mockRejectedValue(
        new Error('Failed to create activity log: Server error message'),
      );

      const request = createMockRequest();

      await expect(createPendingActivityLog(mockHttpClient, request, 'index')).rejects.toThrow(
        'Failed to create activity log: Server error message',
      );
    });

    it('should not throw when createActivityLog succeeds', async () => {
      const request = createMockRequest();

      await expect(
        createPendingActivityLog(mockHttpClient, request, 'index'),
      ).resolves.not.toThrow();
    });
  });
});

describe('markActivityLogAsFailed', () => {
  let mockHttpClient: jest.Mocked<McpHttpClient>;

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
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
      httpClient: mockHttpClient,
      request,
      activityLog,
      errorMessage: 'Something went wrong',
      logger: mockLogger,
    });

    // Wait for the fire-and-forget promise to resolve
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(mockHttpClient.updateActivityLogStatus).toHaveBeenCalledWith({
      forestServerToken: 'test-forest-token',
      activityLog,
      status: 'failed',
      errorMessage: 'Something went wrong',
    });
  });

  it('should retry up to 5 times on 404 response', async () => {
    jest.useFakeTimers();

    const notFoundResponse = {
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue('Not found'),
    };
    mockHttpClient.updateActivityLogStatus
      .mockResolvedValueOnce(notFoundResponse as unknown as Response)
      .mockResolvedValueOnce(notFoundResponse as unknown as Response)
      .mockResolvedValueOnce(notFoundResponse as unknown as Response)
      .mockResolvedValueOnce(notFoundResponse as unknown as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as unknown as Response);

    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      httpClient: mockHttpClient,
      request,
      activityLog,
      errorMessage: 'Something went wrong',
      logger: mockLogger,
    });

    // Advance timers for all retries (4 retries * 500ms delay)
    await jest.advanceTimersByTimeAsync(4000);

    expect(mockHttpClient.updateActivityLogStatus).toHaveBeenCalledTimes(5);
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

    mockHttpClient.updateActivityLogStatus.mockResolvedValue({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue('Not found'),
    } as unknown as Response);

    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      httpClient: mockHttpClient,
      request,
      activityLog,
      errorMessage: 'Something went wrong',
      logger: mockLogger,
    });

    // Advance timers for all retries (4 retries * 500ms delay)
    await jest.advanceTimersByTimeAsync(4000);

    expect(mockHttpClient.updateActivityLogStatus).toHaveBeenCalledTimes(5);
    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      "Failed to update activity log status to 'failed': Not found",
    );

    jest.useRealTimers();
  });

  it('should not retry on non-404 errors', async () => {
    mockHttpClient.updateActivityLogStatus.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal server error'),
    } as unknown as Response);

    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      httpClient: mockHttpClient,
      request,
      activityLog,
      errorMessage: 'Something went wrong',
      logger: mockLogger,
    });

    await new Promise(resolve => {
      setTimeout(resolve, 50);
    });

    expect(mockHttpClient.updateActivityLogStatus).toHaveBeenCalledTimes(1);
    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      "Failed to update activity log status to 'failed': Internal server error",
    );
  });
});

describe('markActivityLogAsSucceeded', () => {
  let mockHttpClient: jest.Mocked<McpHttpClient>;

  beforeEach(() => {
    mockHttpClient = createMockHttpClient();
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
    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsSucceeded({
      httpClient: mockHttpClient,
      request,
      activityLog,
      logger: mockLogger,
    });

    // Wait for the fire-and-forget promise to resolve
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(mockHttpClient.updateActivityLogStatus).toHaveBeenCalledWith({
      forestServerToken: 'test-forest-token',
      activityLog,
      status: 'completed',
      errorMessage: undefined,
    });
  });

  it('should not include errorMessage in completed status', async () => {
    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsSucceeded({
      httpClient: mockHttpClient,
      request,
      activityLog,
      logger: mockLogger,
    });

    // Wait for the fire-and-forget promise to resolve
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(mockHttpClient.updateActivityLogStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: undefined,
      }),
    );
  });
});
