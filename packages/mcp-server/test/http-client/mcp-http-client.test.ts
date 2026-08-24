import type {
  ActivityLogsServiceInterface,
  ForestSchemaCollection,
  SchemaServiceInterface,
  WorkflowsServiceInterface,
} from '../../src/http-client/types';

import { createForestServerClient } from '../../src/http-client';
import ForestServerClientImpl from '../../src/http-client/mcp-http-client';

describe('ForestServerClientImpl', () => {
  let mockSchemaService: jest.Mocked<SchemaServiceInterface>;
  let mockActivityLogsService: jest.Mocked<ActivityLogsServiceInterface>;
  let mockWorkflowsService: jest.Mocked<WorkflowsServiceInterface>;
  let client: ForestServerClientImpl;

  beforeEach(() => {
    mockSchemaService = {
      getSchema: jest.fn(),
    };
    mockActivityLogsService = {
      createActivityLog: jest.fn(),
      createMcpActivityLog: jest.fn(),
      updateActivityLogStatus: jest.fn(),
    };
    mockWorkflowsService = {
      listMcpEnabledWorkflows: jest.fn(),
      getMcpWorkflowById: jest.fn(),
      triggerMcpWorkflow: jest.fn(),
      getMcpWorkflowRun: jest.fn(),
    };
    client = new ForestServerClientImpl(
      mockSchemaService,
      mockActivityLogsService,
      mockWorkflowsService,
      'https://api.forestadmin.com',
    );
  });

  describe('fetchSchema', () => {
    it('should delegate to schemaService.getSchema()', async () => {
      const mockSchema: ForestSchemaCollection[] = [
        {
          name: 'users',
          fields: [],
          actions: [],
          segments: [],
        } as unknown as ForestSchemaCollection,
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

  describe('createMcpActivityLog', () => {
    it('should delegate to activityLogsService.createMcpActivityLog()', async () => {
      const mockActivityLog = { id: 'log-123', attributes: { index: 'idx-456' } };
      mockActivityLogsService.createMcpActivityLog.mockResolvedValue(mockActivityLog);

      const params = {
        forestServerToken: 'test-token',
        renderingId: '12345',
        action: 'index' as const,
        type: 'read' as const,
        collectionName: 'users',
      };

      const result = await client.createMcpActivityLog(params);

      expect(mockActivityLogsService.createMcpActivityLog).toHaveBeenCalledWith(params);
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

  describe('listMcpEnabledWorkflows', () => {
    it('should delegate to workflowsService.listMcpEnabledWorkflows()', async () => {
      const workflows = [{ workflowId: 'wf-1', name: 'Refund order', collectionName: 'orders' }];
      mockWorkflowsService.listMcpEnabledWorkflows.mockResolvedValue(workflows);

      const params = {
        forestServerToken: 'test-token',
        renderingId: '12345',
        collectionName: 'orders',
      };

      const result = await client.listMcpEnabledWorkflows(params);

      expect(mockWorkflowsService.listMcpEnabledWorkflows).toHaveBeenCalledWith(params);
      expect(result).toBe(workflows);
    });
  });

  describe('getMcpWorkflowById', () => {
    it('should delegate to workflowsService.getMcpWorkflowById()', async () => {
      const workflow = {
        workflowId: 'wf-1',
        name: 'Refund order',
        collectionName: 'orders',
        mcpEnabled: true,
      };
      mockWorkflowsService.getMcpWorkflowById.mockResolvedValue(workflow);

      const params = {
        forestServerToken: 'test-token',
        renderingId: '12345',
        workflowId: 'wf-1',
      };

      const result = await client.getMcpWorkflowById(params);

      expect(mockWorkflowsService.getMcpWorkflowById).toHaveBeenCalledWith(params);
      expect(result).toBe(workflow);
    });
  });

  describe('triggerMcpWorkflow', () => {
    it('should delegate to workflowsService.triggerMcpWorkflow()', async () => {
      const run = { runId: '7', runState: 'loading' as const };
      mockWorkflowsService.triggerMcpWorkflow.mockResolvedValue(run);

      const params = {
        forestServerToken: 'test-token',
        renderingId: '12345',
        workflowId: 'wf-1',
        recordId: '42',
      };

      const result = await client.triggerMcpWorkflow(params);

      expect(mockWorkflowsService.triggerMcpWorkflow).toHaveBeenCalledWith(params);
      expect(result).toBe(run);
    });
  });

  describe('getMcpWorkflowRun', () => {
    it('should delegate to workflowsService.getMcpWorkflowRun()', async () => {
      const hydratedRun = {
        id: 7,
        userId: 42,
        renderingId: 12345,
        collectionId: 'orders',
        workflowId: 'wf-1',
        bpmnVersion: '3',
        selectedRecordId: '99',
        runState: 'finished' as const,
        engine: 'orchestrator' as const,
        triggerType: 'mcp' as const,
        lockedAt: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:05:00.000Z',
        workflowHistory: [],
      };
      mockWorkflowsService.getMcpWorkflowRun.mockResolvedValue(hydratedRun);

      const params = {
        forestServerToken: 'test-token',
        renderingId: '12345',
        runId: '7',
      };

      const result = await client.getMcpWorkflowRun(params);

      expect(mockWorkflowsService.getMcpWorkflowRun).toHaveBeenCalledWith(params);
      expect(result).toBe(hydratedRun);
    });
  });
});

describe('createForestServerClient', () => {
  it('should throw an error if envSecret is missing', () => {
    expect(() =>
      createForestServerClient({
        forestServerUrl: 'http://localhost:3000',
      }),
    ).toThrow('envSecret is required to create ForestServerClient');
  });

  it('should throw an error if envSecret is empty string', () => {
    expect(() =>
      createForestServerClient({
        forestServerUrl: 'http://localhost:3000',
        envSecret: '',
      }),
    ).toThrow('envSecret is required to create ForestServerClient');
  });

  it('should create a ForestServerClient when envSecret is provided', () => {
    const client = createForestServerClient({
      forestServerUrl: 'http://localhost:3000',
      envSecret: 'test-secret',
    });

    expect(client).toBeDefined();
    expect(client.fetchSchema).toBeDefined();
    expect(client.createActivityLog).toBeDefined();
    expect(client.createMcpActivityLog).toBeDefined();
    expect(client.updateActivityLogStatus).toBeDefined();
    expect(client.listMcpEnabledWorkflows).toBeDefined();
    expect(client.getMcpWorkflowById).toBeDefined();
    expect(client.triggerMcpWorkflow).toBeDefined();
    expect(client.getMcpWorkflowRun).toBeDefined();
  });
});
