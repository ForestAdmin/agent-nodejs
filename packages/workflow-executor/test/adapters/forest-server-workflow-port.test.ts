import type { PendingStepExecution } from '../../src/types/execution';
import type { CollectionSchema } from '../../src/types/record';
import type { StepOutcome } from '../../src/types/step-outcome';

import { ServerUtils } from '@forestadmin/forestadmin-client';

import ForestServerWorkflowPort from '../../src/adapters/forest-server-workflow-port';

jest.mock('@forestadmin/forestadmin-client', () => ({
  ServerUtils: { query: jest.fn() },
}));

const mockQuery = ServerUtils.query as jest.Mock;

const options = { envSecret: 'env-secret-123', forestServerUrl: 'https://api.forestadmin.com' };

describe('ForestServerWorkflowPort', () => {
  let port: ForestServerWorkflowPort;

  beforeEach(() => {
    jest.clearAllMocks();
    port = new ForestServerWorkflowPort(options);
  });

  describe('getPendingStepExecutions', () => {
    it('should call the pending step executions route', async () => {
      const pending: PendingStepExecution[] = [];
      mockQuery.mockResolvedValue(pending);

      const result = await port.getPendingStepExecutions();

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/liana/v1/workflow-step-executions/pending',
      );
      expect(result).toBe(pending);
    });
  });

  describe('getPendingStepExecutionsForRun', () => {
    it('calls the pending step execution route with the runId query param', async () => {
      const step = { runId: 'run-42' } as PendingStepExecution;
      mockQuery.mockResolvedValue(step);

      const result = await port.getPendingStepExecutionsForRun('run-42');

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/liana/v1/workflow-step-executions/pending?runId=run-42',
      );
      expect(result).toBe(step);
    });

    it('encodes special characters in the runId', async () => {
      mockQuery.mockResolvedValue({} as PendingStepExecution);

      await port.getPendingStepExecutionsForRun('run/42 special');

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/liana/v1/workflow-step-executions/pending?runId=run%2F42%20special',
      );
    });
  });

  describe('updateStepExecution', () => {
    it('should post step outcome to the complete route', async () => {
      mockQuery.mockResolvedValue(undefined);
      const stepOutcome: StepOutcome = {
        type: 'condition',
        stepId: 'step-1',
        stepIndex: 0,
        status: 'success',
        selectedOption: 'optionA',
      };

      await port.updateStepExecution('run-42', stepOutcome);

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'post',
        '/liana/v1/workflow-step-executions/run-42/complete',
        {},
        stepOutcome,
      );
    });
  });

  describe('getCollectionSchema', () => {
    it('should fetch the collection schema by name', async () => {
      const collectionSchema: CollectionSchema = {
        collectionName: 'users',
        collectionDisplayName: 'Users',
        primaryKeyFields: ['id'],
        fields: [],
        actions: [],
      };
      mockQuery.mockResolvedValue(collectionSchema);

      const result = await port.getCollectionSchema('users');

      expect(mockQuery).toHaveBeenCalledWith(options, 'get', '/liana/v1/collections/users');
      expect(result).toEqual(collectionSchema);
    });
  });

  describe('getMcpServerConfigs', () => {
    it('should fetch mcp server configs', async () => {
      const configs = [{ name: 'mcp-1' }];
      mockQuery.mockResolvedValue(configs);

      const result = await port.getMcpServerConfigs();

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/liana/mcp-server-configs-with-details',
      );
      expect(result).toEqual(configs);
    });
  });

  describe('hasRunAccess', () => {
    it('always returns true (stub until orchestrator endpoint is available)', async () => {
      const result = await port.hasRunAccess('run-42', {
        id: 1,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        team: 'admin',
        renderingId: 1,
        role: 'admin',
        permissionLevel: 'admin',
        tags: {},
      });

      expect(result).toBe(true);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('error propagation', () => {
    it('should propagate errors from ServerUtils.query', async () => {
      mockQuery.mockRejectedValue(new Error('Network error'));

      await expect(port.getPendingStepExecutions()).rejects.toThrow('Network error');
    });

    it('should propagate errors from getPendingStepExecutionsForRun', async () => {
      mockQuery.mockRejectedValue(new Error('Network error'));

      await expect(port.getPendingStepExecutionsForRun('run-1')).rejects.toThrow('Network error');
    });
  });
});
