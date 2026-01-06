import type {
  ActivityLogsServiceInterface,
  ForestSchemaCollection,
  SchemaServiceInterface,
} from '../../src/http-client/types';

import ForestServerClientImpl from '../../src/http-client/mcp-http-client';

describe('ForestServerClientImpl', () => {
  let mockSchemaService: jest.Mocked<SchemaServiceInterface>;
  let mockActivityLogsService: jest.Mocked<ActivityLogsServiceInterface>;
  let client: ForestServerClientImpl;

  beforeEach(() => {
    mockSchemaService = {
      getSchema: jest.fn(),
    };
    mockActivityLogsService = {
      createActivityLog: jest.fn(),
      updateActivityLogStatus: jest.fn(),
    };
    client = new ForestServerClientImpl(mockSchemaService, mockActivityLogsService);
  });

  describe('fetchSchema', () => {
    it('should delegate to schemaService.getSchema()', async () => {
      const mockSchema: ForestSchemaCollection[] = [
        { name: 'users', fields: [], actions: [], segments: [] } as unknown as ForestSchemaCollection,
      ];
      mockSchemaService.getSchema.mockResolvedValue(mockSchema);

      const result = await client.fetchSchema();

      expect(mockSchemaService.getSchema).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockSchema);
    });
  });

  describe('createActivityLog', () => {
    it('should delegate to activityLogsService.createActivityLog()', async () => {
      const mockActivityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
      mockActivityLogsService.createActivityLog.mockResolvedValue(mockActivityLog);

      const params = {
        forestServerToken: 'test-token',
        renderingId: '12345',
        action: 'index' as const,
        type: 'read' as const,
        collectionName: 'users',
      };

      const result = await client.createActivityLog(params);

      expect(mockActivityLogsService.createActivityLog).toHaveBeenCalledWith(params);
      expect(result).toBe(mockActivityLog);
    });
  });

  describe('updateActivityLogStatus', () => {
    it('should delegate to activityLogsService.updateActivityLogStatus()', async () => {
      mockActivityLogsService.updateActivityLogStatus.mockResolvedValue(undefined);

      const params = {
        forestServerToken: 'test-token',
        activityLog: { id: 'log-123', attributes: { index: 'idx-456' } },
        status: 'completed' as const,
      };

      await client.updateActivityLogStatus(params);

      expect(mockActivityLogsService.updateActivityLogStatus).toHaveBeenCalledWith(params);
    });
  });
});
