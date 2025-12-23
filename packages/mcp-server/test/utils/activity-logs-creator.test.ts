import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import createActivityLog, { ActivityLogAction } from '../../src/utils/activity-logs-creator';

describe('createActivityLog', () => {
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
      ['action', 'write'],
      ['create', 'write'],
      ['update', 'write'],
      ['delete', 'write'],
    ])('should map action "%s" to type "%s"', async (action, expectedType) => {
      const request = createMockRequest();

      await createActivityLog('https://api.forestadmin.com', request, action);

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

      await createActivityLog('https://api.forestadmin.com', request, 'index');

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

      await createActivityLog('https://api.forestadmin.com', request, 'index');

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

      await createActivityLog('https://api.forestadmin.com', request, 'index');

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

      await createActivityLog('https://api.forestadmin.com', request, 'index', {
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

      await createActivityLog('https://api.forestadmin.com', request, 'index');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.relationships.collection.data).toBeNull();
    });

    it('should include rendering relationship', async () => {
      const request = createMockRequest();

      await createActivityLog('https://api.forestadmin.com', request, 'index');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.relationships.rendering.data).toEqual({
        id: '12345',
        type: 'renderings',
      });
    });

    it('should include label in attributes when provided', async () => {
      const request = createMockRequest();

      await createActivityLog('https://api.forestadmin.com', request, 'action', {
        label: 'Custom Action Label',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.label).toBe('Custom Action Label');
    });

    it('should include single recordId in records array', async () => {
      const request = createMockRequest();

      await createActivityLog('https://api.forestadmin.com', request, 'update', {
        recordId: 42,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.records).toEqual([42]);
    });

    it('should include multiple recordIds in records array', async () => {
      const request = createMockRequest();

      await createActivityLog('https://api.forestadmin.com', request, 'delete', {
        recordIds: [1, 2, 3],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.records).toEqual([1, 2, 3]);
    });

    it('should prefer recordIds over recordId when both provided', async () => {
      const request = createMockRequest();

      await createActivityLog('https://api.forestadmin.com', request, 'delete', {
        recordId: 99,
        recordIds: [1, 2, 3],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.records).toEqual([1, 2, 3]);
    });

    it('should send empty records array when no recordId or recordIds provided', async () => {
      const request = createMockRequest();

      await createActivityLog('https://api.forestadmin.com', request, 'index');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.records).toEqual([]);
    });

    it('should include action name in attributes', async () => {
      const request = createMockRequest();

      await createActivityLog('https://api.forestadmin.com', request, 'search');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.data.attributes.action).toBe('search');
    });

    it('should use correct data structure', async () => {
      const request = createMockRequest();

      await createActivityLog('https://api.forestadmin.com', request, 'index', {
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
        createActivityLog('https://api.forestadmin.com', request, 'index'),
      ).rejects.toThrow('Failed to create activity log: Server error message');
    });

    it('should not throw when response is ok', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const request = createMockRequest();

      await expect(
        createActivityLog('https://api.forestadmin.com', request, 'index'),
      ).resolves.not.toThrow();
    });
  });

  describe('URL construction', () => {
    it('should append /api/activity-logs-requests to forest server URL', async () => {
      const request = createMockRequest();

      await createActivityLog('https://custom.forestadmin.com', request, 'index');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.forestadmin.com/api/activity-logs-requests',
        expect.any(Object),
      );
    });
  });
});
