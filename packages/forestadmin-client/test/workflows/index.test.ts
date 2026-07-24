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
  });
});
