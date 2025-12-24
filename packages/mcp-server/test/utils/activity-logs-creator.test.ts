import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import createPendingActivityLog, {
  ActivityLogAction,
  markActivityLogAsFailed,
  markActivityLogAsSucceeded,
} from '../../src/utils/activity-logs-creator';

describe('createPendingActivityLog', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
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
      ['action', 'write'],
      ['create', 'write'],
      ['update', 'write'],
      ['delete', 'write'],
    ])('should map action "%s" to type "%s"', async (action, expectedType) => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, action);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.forestadmin.com/api/activity-logs-requests',
        expect.objectContaining({
          body: expect.stringContaining(`"type":"${expectedType}"`),
        }),
      );
    });
  });

  describe('request formatting', () => {
    it('should send correct headers with forestServerToken from authInfo.extra', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'index');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.forestadmin.com/api/activity-logs-requests',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Forest-Application-Source': 'MCP',
            Authorization: 'Bearer test-forest-token',
          },
        }),
      );
    });

    it('should use forestServerToken for Authorization header (not the MCP token)', async () => {
      // This test documents that the activity log API requires the original Forest server token,
      // not the MCP-generated JWT token. The forestServerToken must be passed through
      // authInfo.extra from the OAuth provider's verifyAccessToken method.
      const request = {
        authInfo: {
          token: 'mcp-jwt-token-should-not-be-used',
          extra: {
            forestServerToken: 'original-forest-server-token',
            renderingId: '12345',
          },
        },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      await createPendingActivityLog('https://api.forestadmin.com', request, 'index');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.forestadmin.com/api/activity-logs-requests',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer original-forest-server-token',
          }),
        }),
      );
    });

    it('should send undefined token when forestServerToken is missing from extra', async () => {
      // This test documents the error case: if forestServerToken is not passed in extra,
      // the Authorization header will be "Bearer undefined" which will fail
      const request = {
        authInfo: {
          token: 'mcp-jwt-token',
          extra: {
            renderingId: '12345',
            // forestServerToken is missing!
          },
        },
      } as unknown as RequestHandlerExtra<ServerRequest, ServerNotification>;

      await createPendingActivityLog('https://api.forestadmin.com', request, 'index');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.forestadmin.com/api/activity-logs-requests',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer undefined',
          }),
        }),
      );
    });

    it('should include collection name in relationships when provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'index', {
        collectionName: 'users',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.relationships.collection.data).toEqual({
        id: 'users',
        type: 'collections',
      });
    });

    it('should set collection data to null when collectionName is not provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'index');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.relationships.collection.data).toBeNull();
    });

    it('should include rendering relationship', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'index');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.relationships.rendering.data).toEqual({
        id: '12345',
        type: 'renderings',
      });
    });

    it('should include label in attributes when provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'action', {
        label: 'Custom Action Label',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.label).toBe('Custom Action Label');
    });

    it('should include single recordId in records array', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'update', {
        recordId: 42,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.records).toEqual([42]);
    });

    it('should include multiple recordIds in records array', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'delete', {
        recordIds: [1, 2, 3],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.records).toEqual([1, 2, 3]);
    });

    it('should prefer recordIds over recordId when both provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'delete', {
        recordId: 99,
        recordIds: [1, 2, 3],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.records).toEqual([1, 2, 3]);
    });

    it('should send empty records array when no recordId or recordIds provided', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'index');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.records).toEqual([]);
    });

    it('should include action name in attributes', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'search');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.action).toBe('search');
    });

    it('should use correct data structure', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://api.forestadmin.com', request, 'index', {
        collectionName: 'products',
        recordId: 1,
        label: 'View Product',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody).toEqual({
        data: {
          id: 1,
          type: 'activity-logs-requests',
          attributes: {
            type: 'read',
            action: 'index',
            label: 'View Product',
            status: 'pending',
            records: [1],
          },
          relationships: {
            rendering: {
              data: {
                id: '12345',
                type: 'renderings',
              },
            },
            collection: {
              data: {
                id: 'products',
                type: 'collections',
              },
            },
          },
        },
      });
    });
  });

  describe('error handling', () => {
    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Server error message'),
      });

      const request = createMockRequest();

      await expect(
        createPendingActivityLog('https://api.forestadmin.com', request, 'index'),
      ).rejects.toThrow('Failed to create activity log: Server error message');
    });

    it('should not throw when response is ok', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const request = createMockRequest();

      await expect(
        createPendingActivityLog('https://api.forestadmin.com', request, 'index'),
      ).resolves.not.toThrow();
    });
  });

  describe('URL construction', () => {
    it('should append /api/activity-logs-requests to forest server URL', async () => {
      const request = createMockRequest();

      await createPendingActivityLog('https://custom.forestadmin.com', request, 'index');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.forestadmin.com/api/activity-logs-requests',
        expect.any(Object),
      );
    });
  });
});

describe('markActivityLogAsFailed', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
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

  it('should send PATCH request with failed status and error message', async () => {
    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      forestServerUrl: 'https://api.forestadmin.com',
      request,
      activityLog,
      errorMessage: 'Something went wrong',
      logger: mockLogger,
    });

    // Wait for the fire-and-forget promise to resolve
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.forestadmin.com/api/activity-logs-requests/idx-456/log-123/status',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Forest-Application-Source': 'MCP',
          Authorization: 'Bearer test-forest-token',
        },
        body: JSON.stringify({
          status: 'failed',
          errorMessage: 'Something went wrong',
        }),
      },
    );
  });

  it('should retry up to 5 times on 404 response', async () => {
    const notFoundResponse = {
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue('Not found'),
    };
    mockFetch
      .mockResolvedValueOnce(notFoundResponse)
      .mockResolvedValueOnce(notFoundResponse)
      .mockResolvedValueOnce(notFoundResponse)
      .mockResolvedValueOnce(notFoundResponse)
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      forestServerUrl: 'https://api.forestadmin.com',
      request,
      activityLog,
      errorMessage: 'Something went wrong',
      logger: mockLogger,
    });

    // Wait for all retries to complete (5 attempts * 200ms delay + buffer)
    await new Promise(resolve => {
      setTimeout(resolve, 1200);
    });

    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(mockLogger).toHaveBeenCalledWith(
      'Debug',
      'Activity log not found (attempt 1/5), retrying...',
    );
    expect(mockLogger).toHaveBeenCalledWith(
      'Debug',
      'Activity log not found (attempt 4/5), retrying...',
    );
  });

  it('should stop retrying after 5 failed attempts and log error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue('Not found'),
    });

    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      forestServerUrl: 'https://api.forestadmin.com',
      request,
      activityLog,
      errorMessage: 'Something went wrong',
      logger: mockLogger,
    });

    // Wait for all retries to complete
    await new Promise(resolve => {
      setTimeout(resolve, 1200);
    });

    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      "Failed to update activity log status to 'failed': Not found",
    );
  });

  it('should not retry on non-404 errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('Internal server error'),
    });

    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsFailed({
      forestServerUrl: 'https://api.forestadmin.com',
      request,
      activityLog,
      errorMessage: 'Something went wrong',
      logger: mockLogger,
    });

    await new Promise(resolve => {
      setTimeout(resolve, 50);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockLogger).toHaveBeenCalledWith(
      'Error',
      "Failed to update activity log status to 'failed': Internal server error",
    );
  });
});

describe('markActivityLogAsSucceeded', () => {
  const originalFetch = global.fetch;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
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

  it('should send PATCH request with completed status', async () => {
    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsSucceeded({
      forestServerUrl: 'https://api.forestadmin.com',
      request,
      activityLog,
      logger: mockLogger,
    });

    // Wait for the fire-and-forget promise to resolve
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.forestadmin.com/api/activity-logs-requests/idx-456/log-123/status',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Forest-Application-Source': 'MCP',
          Authorization: 'Bearer test-forest-token',
        },
        body: JSON.stringify({
          status: 'completed',
        }),
      },
    );
  });

  it('should not include errorMessage in completed status', async () => {
    const request = createMockRequest();
    const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
    const mockLogger = jest.fn();

    markActivityLogAsSucceeded({
      forestServerUrl: 'https://api.forestadmin.com',
      request,
      activityLog,
      logger: mockLogger,
    });

    // Wait for the fire-and-forget promise to resolve
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody).not.toHaveProperty('errorMessage');
  });
});
