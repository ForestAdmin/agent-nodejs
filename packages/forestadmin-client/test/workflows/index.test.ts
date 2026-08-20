import type { ForestAdminServerInterface, McpWorkflow } from '../../src/types';

import WorkflowsService from '../../src/workflows';
import * as factories from '../__factories__';

describe('WorkflowsService', () => {
  const options = {
    forestServerUrl: 'http://forestadmin-server.com',
  };
  let mockForestAdminServerInterface: jest.Mocked<ForestAdminServerInterface>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockForestAdminServerInterface =
      factories.forestAdminServerInterface.build() as jest.Mocked<ForestAdminServerInterface>;
  });

  describe('listMcpEnabledWorkflows', () => {
    const workflows: McpWorkflow[] = [
      { workflowId: 'wf-1', name: 'Refund order', collectionName: 'orders' },
    ];

    it('should forward the bearer token and rendering id to the transport', async () => {
      mockForestAdminServerInterface.listMcpEnabledWorkflows.mockResolvedValue(workflows);

      const service = new WorkflowsService(mockForestAdminServerInterface, options);
      const result = await service.listMcpEnabledWorkflows({
        forestServerToken: 'test-token',
        renderingId: '12345',
      });

      expect(result).toEqual(workflows);
      expect(mockForestAdminServerInterface.listMcpEnabledWorkflows).toHaveBeenCalledWith(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'test-token', headers: undefined },
        '12345',
        undefined,
      );
    });

    it('should forward the collectionName filter when provided', async () => {
      mockForestAdminServerInterface.listMcpEnabledWorkflows.mockResolvedValue(workflows);

      const service = new WorkflowsService(mockForestAdminServerInterface, options);
      await service.listMcpEnabledWorkflows({
        forestServerToken: 'test-token',
        renderingId: '12345',
        collectionName: 'orders',
      });

      expect(mockForestAdminServerInterface.listMcpEnabledWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({ bearerToken: 'test-token' }),
        '12345',
        'orders',
      );
    });

    it('should pass custom headers when provided', async () => {
      mockForestAdminServerInterface.listMcpEnabledWorkflows.mockResolvedValue(workflows);

      const service = new WorkflowsService(mockForestAdminServerInterface, {
        ...options,
        headers: { 'Forest-Application-Source': 'MCP' },
      });
      await service.listMcpEnabledWorkflows({
        forestServerToken: 'test-token',
        renderingId: '12345',
      });

      expect(mockForestAdminServerInterface.listMcpEnabledWorkflows).toHaveBeenCalledWith(
        expect.objectContaining({
          bearerToken: 'test-token',
          headers: { 'Forest-Application-Source': 'MCP' },
        }),
        '12345',
        undefined,
      );
    });

    it('should throw when the transport does not implement listMcpEnabledWorkflows', async () => {
      delete (mockForestAdminServerInterface as Partial<ForestAdminServerInterface>)
        .listMcpEnabledWorkflows;

      const service = new WorkflowsService(mockForestAdminServerInterface, options);

      await expect(
        service.listMcpEnabledWorkflows({ forestServerToken: 'test-token', renderingId: '12345' }),
      ).rejects.toThrow('does not support listMcpEnabledWorkflows');
    });
  });

  describe('getMcpWorkflowById', () => {
    const workflow = {
      workflowId: 'wf-1',
      name: 'Refund order',
      collectionName: 'orders',
      mcpEnabled: true,
    };

    it('should forward the identity and workflowId to the transport and return the workflow', async () => {
      mockForestAdminServerInterface.getMcpWorkflowById.mockResolvedValue(workflow);

      const service = new WorkflowsService(mockForestAdminServerInterface, options);
      const result = await service.getMcpWorkflowById({
        forestServerToken: 'test-token',
        renderingId: '12345',
        workflowId: 'wf-1',
      });

      expect(result).toEqual(workflow);
      expect(mockForestAdminServerInterface.getMcpWorkflowById).toHaveBeenCalledWith(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'test-token', headers: undefined },
        '12345',
        'wf-1',
      );
    });

    it('should pass custom headers when provided', async () => {
      mockForestAdminServerInterface.getMcpWorkflowById.mockResolvedValue(workflow);

      const service = new WorkflowsService(mockForestAdminServerInterface, {
        ...options,
        headers: { 'Forest-Application-Source': 'MCP' },
      });
      await service.getMcpWorkflowById({
        forestServerToken: 'test-token',
        renderingId: '12345',
        workflowId: 'wf-1',
      });

      expect(mockForestAdminServerInterface.getMcpWorkflowById).toHaveBeenCalledWith(
        expect.objectContaining({
          bearerToken: 'test-token',
          headers: { 'Forest-Application-Source': 'MCP' },
        }),
        '12345',
        'wf-1',
      );
    });

    it('should throw when the transport does not implement getMcpWorkflowById', async () => {
      delete (mockForestAdminServerInterface as Partial<ForestAdminServerInterface>)
        .getMcpWorkflowById;

      const service = new WorkflowsService(mockForestAdminServerInterface, options);

      await expect(
        service.getMcpWorkflowById({
          forestServerToken: 'test-token',
          renderingId: '12345',
          workflowId: 'wf-1',
        }),
      ).rejects.toThrow('does not support getMcpWorkflowById');
    });
  });

  describe('triggerMcpWorkflow', () => {
    it('should forward the identity, workflowId and recordId to the transport and return the run', async () => {
      mockForestAdminServerInterface.triggerMcpWorkflow.mockResolvedValue({
        runId: '7',
        runState: 'loading',
      });

      const service = new WorkflowsService(mockForestAdminServerInterface, options);
      const result = await service.triggerMcpWorkflow({
        forestServerToken: 'test-token',
        renderingId: '12345',
        workflowId: 'wf-1',
        recordId: '42',
      });

      expect(result).toEqual({ runId: '7', runState: 'loading' });
      expect(mockForestAdminServerInterface.triggerMcpWorkflow).toHaveBeenCalledWith(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'test-token', headers: undefined },
        '12345',
        'wf-1',
        '42',
      );
    });

    it('should pass custom headers when provided', async () => {
      mockForestAdminServerInterface.triggerMcpWorkflow.mockResolvedValue({
        runId: '7',
        runState: 'loading',
      });

      const service = new WorkflowsService(mockForestAdminServerInterface, {
        ...options,
        headers: { 'Forest-Application-Source': 'MCP' },
      });
      await service.triggerMcpWorkflow({
        forestServerToken: 'test-token',
        renderingId: '12345',
        workflowId: 'wf-1',
        recordId: '42',
      });

      expect(mockForestAdminServerInterface.triggerMcpWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          bearerToken: 'test-token',
          headers: { 'Forest-Application-Source': 'MCP' },
        }),
        '12345',
        'wf-1',
        '42',
      );
    });

    it('should throw when the transport does not implement triggerMcpWorkflow', async () => {
      delete (mockForestAdminServerInterface as Partial<ForestAdminServerInterface>)
        .triggerMcpWorkflow;

      const service = new WorkflowsService(mockForestAdminServerInterface, options);

      await expect(
        service.triggerMcpWorkflow({
          forestServerToken: 'test-token',
          renderingId: '12345',
          workflowId: 'wf-1',
          recordId: '42',
        }),
      ).rejects.toThrow('does not support triggerMcpWorkflow');
    });
  });

  describe('getMcpWorkflowRun', () => {
    const runStatus = {
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

    it('should forward the identity and runId to the transport and return the status', async () => {
      mockForestAdminServerInterface.getMcpWorkflowRun.mockResolvedValue(runStatus);

      const service = new WorkflowsService(mockForestAdminServerInterface, options);
      const result = await service.getMcpWorkflowRun({
        forestServerToken: 'test-token',
        renderingId: '12345',
        runId: '7',
      });

      expect(result).toEqual(runStatus);
      expect(mockForestAdminServerInterface.getMcpWorkflowRun).toHaveBeenCalledWith(
        { forestServerUrl: options.forestServerUrl, bearerToken: 'test-token', headers: undefined },
        '12345',
        '7',
      );
    });

    it('should pass custom headers when provided', async () => {
      mockForestAdminServerInterface.getMcpWorkflowRun.mockResolvedValue(runStatus);

      const service = new WorkflowsService(mockForestAdminServerInterface, {
        ...options,
        headers: { 'Forest-Application-Source': 'MCP' },
      });
      await service.getMcpWorkflowRun({
        forestServerToken: 'test-token',
        renderingId: '12345',
        runId: '7',
      });

      expect(mockForestAdminServerInterface.getMcpWorkflowRun).toHaveBeenCalledWith(
        expect.objectContaining({
          bearerToken: 'test-token',
          headers: { 'Forest-Application-Source': 'MCP' },
        }),
        '12345',
        '7',
      );
    });

    it('should throw when the transport does not implement getMcpWorkflowRun', async () => {
      delete (mockForestAdminServerInterface as Partial<ForestAdminServerInterface>)
        .getMcpWorkflowRun;

      const service = new WorkflowsService(mockForestAdminServerInterface, options);

      await expect(
        service.getMcpWorkflowRun({
          forestServerToken: 'test-token',
          renderingId: '12345',
          runId: '7',
        }),
      ).rejects.toThrow('does not support getMcpWorkflowRun');
    });
  });
});
