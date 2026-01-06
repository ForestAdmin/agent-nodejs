import ActivityLogsService from '../../src/activity-logs';
import ServerUtils from '../../src/utils/server';

jest.mock('../../src/utils/server');

const queryWithBearerTokenMock = ServerUtils.queryWithBearerToken as jest.Mock;

describe('ActivityLogsService', () => {
  const options = { forestServerUrl: 'http://forestadmin-server.com' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createActivityLog', () => {
    it('should create an activity log with all parameters', async () => {
      const mockActivityLog = {
        id: 'log-123',
        attributes: { index: 'idx-456' },
      };
      queryWithBearerTokenMock.mockResolvedValue({ data: mockActivityLog });

      const service = new ActivityLogsService(options);
      const result = await service.createActivityLog({
        forestServerToken: 'test-token',
        renderingId: '12345',
        action: 'index',
        type: 'read',
        collectionName: 'users',
        recordId: '42',
        label: 'Custom Label',
      });

      expect(result).toEqual(mockActivityLog);
      expect(queryWithBearerTokenMock).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'post',
        path: '/api/activity-logs-requests',
        bearerToken: 'test-token',
        headers: undefined,
        body: {
          data: {
            id: 1,
            type: 'activity-logs-requests',
            attributes: {
              type: 'read',
              action: 'index',
              label: 'Custom Label',
              status: 'pending',
              records: ['42'],
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
                  id: 'users',
                  type: 'collections',
                },
              },
            },
          },
        },
      });
    });

    it('should create an activity log with recordIds array', async () => {
      const mockActivityLog = {
        id: 'log-123',
        attributes: { index: 'idx-456' },
      };
      queryWithBearerTokenMock.mockResolvedValue({ data: mockActivityLog });

      const service = new ActivityLogsService(options);
      await service.createActivityLog({
        forestServerToken: 'test-token',
        renderingId: '12345',
        action: 'delete',
        type: 'write',
        collectionName: 'users',
        recordIds: ['1', '2', '3'],
      });

      expect(queryWithBearerTokenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            data: expect.objectContaining({
              attributes: expect.objectContaining({
                records: ['1', '2', '3'],
              }),
            }),
          }),
        }),
      );
    });

    it('should create an activity log without collection', async () => {
      const mockActivityLog = {
        id: 'log-123',
        attributes: { index: 'idx-456' },
      };
      queryWithBearerTokenMock.mockResolvedValue({ data: mockActivityLog });

      const service = new ActivityLogsService(options);
      await service.createActivityLog({
        forestServerToken: 'test-token',
        renderingId: '12345',
        action: 'search',
        type: 'read',
      });

      expect(queryWithBearerTokenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            data: expect.objectContaining({
              attributes: expect.objectContaining({
                records: [],
              }),
              relationships: expect.objectContaining({
                collection: {
                  data: null,
                },
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('updateActivityLogStatus', () => {
    it('should update activity log status to completed', async () => {
      queryWithBearerTokenMock.mockResolvedValue(undefined);

      const service = new ActivityLogsService(options);
      const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };

      await service.updateActivityLogStatus({
        forestServerToken: 'test-token',
        activityLog,
        status: 'completed',
      });

      expect(queryWithBearerTokenMock).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'patch',
        path: '/api/activity-logs-requests/idx-456/log-123/status',
        bearerToken: 'test-token',
        headers: undefined,
        body: {
          status: 'completed',
        },
      });
    });

    it('should update activity log status to failed with error message', async () => {
      queryWithBearerTokenMock.mockResolvedValue(undefined);

      const service = new ActivityLogsService(options);
      const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };

      await service.updateActivityLogStatus({
        forestServerToken: 'test-token',
        activityLog,
        status: 'failed',
        errorMessage: 'Something went wrong',
      });

      expect(queryWithBearerTokenMock).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'patch',
        path: '/api/activity-logs-requests/idx-456/log-123/status',
        bearerToken: 'test-token',
        headers: undefined,
        body: {
          status: 'failed',
          errorMessage: 'Something went wrong',
        },
      });
    });

    it('should pass custom headers when provided', async () => {
      queryWithBearerTokenMock.mockResolvedValue(undefined);

      const optionsWithHeaders = {
        ...options,
        headers: { 'Custom-Header': 'value' },
      };
      const service = new ActivityLogsService(optionsWithHeaders);
      const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };

      await service.updateActivityLogStatus({
        forestServerToken: 'test-token',
        activityLog,
        status: 'completed',
      });

      expect(queryWithBearerTokenMock).toHaveBeenCalledWith({
        forestServerUrl: options.forestServerUrl,
        method: 'patch',
        path: '/api/activity-logs-requests/idx-456/log-123/status',
        bearerToken: 'test-token',
        headers: { 'Custom-Header': 'value' },
        body: {
          status: 'completed',
        },
      });
    });
  });
});
