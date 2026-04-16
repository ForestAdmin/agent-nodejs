import type { ForestAdminServerInterface } from '../../src/types';

import { NotFoundError } from '../../src/auth/errors';
import ActivityLogsService from '../../src/activity-logs';
import ServerUtils from '../../src/utils/server';
import * as factories from '../__factories__';

jest.mock('../../src/utils/server');

describe('ActivityLogsService', () => {
  const options = {
    forestServerUrl: 'http://forestadmin-server.com',
  };
  let mockForestAdminServerInterface: jest.Mocked<ForestAdminServerInterface>;

  const mockQueryWithBearerToken = ServerUtils.queryWithBearerToken as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockForestAdminServerInterface =
      factories.forestAdminServerInterface.build() as jest.Mocked<ForestAdminServerInterface>;
    // Default: collection ID resolution succeeds
    mockQueryWithBearerToken.mockResolvedValue({ collectionId: 'resolved-id-123' });
  });

  describe('createActivityLog', () => {
    it('should create an activity log with all parameters', async () => {
      const mockActivityLog = {
        id: 'log-123',
        attributes: { index: 'idx-456' },
      };
      mockForestAdminServerInterface.createActivityLog.mockResolvedValue(mockActivityLog);

      const service = new ActivityLogsService(mockForestAdminServerInterface, options);
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
      expect(mockForestAdminServerInterface.createActivityLog).toHaveBeenCalledWith(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'test-token', headers: undefined },
        {
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
                  id: 'resolved-id-123',
                  type: 'collections',
                },
              },
            },
          },
        },
      );
    });

    it('should create an activity log with recordIds array', async () => {
      const mockActivityLog = {
        id: 'log-123',
        attributes: { index: 'idx-456' },
      };
      mockForestAdminServerInterface.createActivityLog.mockResolvedValue(mockActivityLog);

      const service = new ActivityLogsService(mockForestAdminServerInterface, options);
      await service.createActivityLog({
        forestServerToken: 'test-token',
        renderingId: '12345',
        action: 'delete',
        type: 'write',
        collectionName: 'users',
        recordIds: ['1', '2', '3'],
      });

      expect(mockForestAdminServerInterface.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ bearerToken: 'test-token' }),
        expect.objectContaining({
          data: expect.objectContaining({
            attributes: expect.objectContaining({
              records: ['1', '2', '3'],
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
      mockForestAdminServerInterface.createActivityLog.mockResolvedValue(mockActivityLog);

      const service = new ActivityLogsService(mockForestAdminServerInterface, options);
      await service.createActivityLog({
        forestServerToken: 'test-token',
        renderingId: '12345',
        action: 'search',
        type: 'read',
      });

      expect(mockForestAdminServerInterface.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ bearerToken: 'test-token' }),
        expect.objectContaining({
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
      );
    });

    it('should pass custom headers when provided', async () => {
      const mockActivityLog = {
        id: 'log-123',
        attributes: { index: 'idx-456' },
      };
      mockForestAdminServerInterface.createActivityLog.mockResolvedValue(mockActivityLog);

      const optionsWithHeaders = {
        ...options,
        headers: { 'Custom-Header': 'value' },
      };
      const service = new ActivityLogsService(mockForestAdminServerInterface, optionsWithHeaders);
      await service.createActivityLog({
        forestServerToken: 'test-token',
        renderingId: '12345',
        action: 'search',
        type: 'read',
      });

      expect(mockForestAdminServerInterface.createActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          bearerToken: 'test-token',
          headers: { 'Custom-Header': 'value' },
        }),
        expect.anything(),
      );
    });
  });

  describe('resolveCollectionId', () => {
    it('should resolve collectionName to collectionId via server endpoint', async () => {
      mockForestAdminServerInterface.createActivityLog.mockResolvedValue({
        id: 'log-1',
        attributes: { index: 'idx-1' },
      });
      mockQueryWithBearerToken.mockResolvedValue({ collectionId: 'col-456' });

      const service = new ActivityLogsService(mockForestAdminServerInterface, options);
      await service.createActivityLog({
        forestServerToken: 'token',
        renderingId: '100',
        action: 'index',
        type: 'read',
        collectionName: 'users',
      });

      expect(mockQueryWithBearerToken).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'get',
          path: '/api/renderings/100/collections/users/id',
        }),
      );
      expect(mockForestAdminServerInterface.createActivityLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            relationships: expect.objectContaining({
              collection: { data: { id: 'col-456', type: 'collections' } },
            }),
          }),
        }),
      );
    });

    it('should cache resolved collectionId and not call server again', async () => {
      mockForestAdminServerInterface.createActivityLog.mockResolvedValue({
        id: 'log-1',
        attributes: { index: 'idx-1' },
      });
      mockQueryWithBearerToken.mockResolvedValue({ collectionId: 'col-789' });

      const service = new ActivityLogsService(mockForestAdminServerInterface, options);

      await service.createActivityLog({
        forestServerToken: 'token',
        renderingId: '100',
        action: 'index',
        type: 'read',
        collectionName: 'users',
      });
      await service.createActivityLog({
        forestServerToken: 'token',
        renderingId: '100',
        action: 'index',
        type: 'read',
        collectionName: 'users',
      });

      expect(mockQueryWithBearerToken).toHaveBeenCalledTimes(1);
    });

    it('should fallback to collectionName when server returns 404', async () => {
      mockForestAdminServerInterface.createActivityLog.mockResolvedValue({
        id: 'log-1',
        attributes: { index: 'idx-1' },
      });
      mockQueryWithBearerToken.mockRejectedValue(new NotFoundError('Not found'));

      const service = new ActivityLogsService(mockForestAdminServerInterface, options);
      await service.createActivityLog({
        forestServerToken: 'token',
        renderingId: '100',
        action: 'index',
        type: 'read',
        collectionName: 'users',
      });

      expect(mockForestAdminServerInterface.createActivityLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            relationships: expect.objectContaining({
              collection: { data: { id: 'users', type: 'collections' } },
            }),
          }),
        }),
      );
    });

    it('should propagate non-404 errors', async () => {
      mockQueryWithBearerToken.mockRejectedValue(new Error('Network error'));

      const service = new ActivityLogsService(mockForestAdminServerInterface, options);

      await expect(
        service.createActivityLog({
          forestServerToken: 'token',
          renderingId: '100',
          action: 'index',
          type: 'read',
          collectionName: 'users',
        }),
      ).rejects.toThrow('Network error');
    });
  });

  describe('updateActivityLogStatus', () => {
    it('should update activity log status to completed', async () => {
      mockForestAdminServerInterface.updateActivityLogStatus.mockResolvedValue(undefined);

      const service = new ActivityLogsService(mockForestAdminServerInterface, options);
      const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };

      await service.updateActivityLogStatus({
        forestServerToken: 'test-token',
        activityLog,
        status: 'completed',
      });

      expect(mockForestAdminServerInterface.updateActivityLogStatus).toHaveBeenCalledWith(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'test-token', headers: undefined },
        'idx-456',
        'log-123',
        { status: 'completed' },
      );
    });

    it('should update activity log status to failed with error message', async () => {
      mockForestAdminServerInterface.updateActivityLogStatus.mockResolvedValue(undefined);

      const service = new ActivityLogsService(mockForestAdminServerInterface, options);
      const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };

      await service.updateActivityLogStatus({
        forestServerToken: 'test-token',
        activityLog,
        status: 'failed',
        errorMessage: 'Something went wrong',
      });

      expect(mockForestAdminServerInterface.updateActivityLogStatus).toHaveBeenCalledWith(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'test-token', headers: undefined },
        'idx-456',
        'log-123',
        { status: 'failed', errorMessage: 'Something went wrong' },
      );
    });

    it('should pass custom headers when updating status', async () => {
      mockForestAdminServerInterface.updateActivityLogStatus.mockResolvedValue(undefined);

      const optionsWithHeaders = {
        ...options,
        headers: { 'Custom-Header': 'value' },
      };
      const service = new ActivityLogsService(mockForestAdminServerInterface, optionsWithHeaders);
      const activityLog = { id: 'log-123', attributes: { index: 'idx-456' } };

      await service.updateActivityLogStatus({
        forestServerToken: 'test-token',
        activityLog,
        status: 'completed',
      });

      expect(mockForestAdminServerInterface.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          bearerToken: 'test-token',
          headers: { 'Custom-Header': 'value' },
        }),
        'idx-456',
        'log-123',
        { status: 'completed' },
      );
    });
  });
});
