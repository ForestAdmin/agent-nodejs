import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

import createActivityLog from './activity-logs-creator.js';

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
    it.each([
      ['index', 'read'],
      ['search', 'read'],
      ['filters', 'read'],
      ['listHasMany', 'read'],
      ['actionForm', 'read'],
      ['availableActions', 'read'],
      ['availableCollections', 'read'],
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

    it('should throw error for unknown action type', async () => {
      const request = createMockRequest();

      await expect(
        createActivityLog('https://api.forestadmin.com', request, 'unknownAction'),
      ).rejects.toThrow('Unknown action type: unknownAction');
    });
  });

  describe('request formatting', () => {
    it('should send correct headers', async () => {
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
