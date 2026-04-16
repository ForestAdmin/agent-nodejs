import type { ForestAdminServerInterface } from '../../src/types';

import ActivityLogsService from '../../src/activity-logs';
import * as factories from '../__factories__';

describe('ActivityLogsService', () => {
  const options = {
    forestServerUrl: 'http://forestadmin-server.com',
  };
  let mockForestAdminServerInterface: jest.Mocked<ForestAdminServerInterface>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockForestAdminServerInterface =
      factories.forestAdminServerInterface.build() as jest.Mocked<ForestAdminServerInterface>;
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
                  id: 'users',
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
