import type { PendingStepExecution } from '../../src/types/execution';
import type { CollectionSchema } from '../../src/types/record';
import type { StepHistory } from '../../src/types/step-history';

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

  describe('updateStepExecution', () => {
    it('should post step history to the complete route', async () => {
      mockQuery.mockResolvedValue(undefined);
      const stepHistory: StepHistory = {
        type: 'condition',
        stepId: 'step-1',
        stepIndex: 0,
        status: 'success',
        selectedOption: 'optionA',
      };

      await port.updateStepExecution('run-42', stepHistory);

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'post',
        '/liana/v1/workflow-step-executions/run-42/complete',
        {},
        stepHistory,
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

  describe('error propagation', () => {
    it('should propagate errors from ServerUtils.query', async () => {
      mockQuery.mockRejectedValue(new Error('Network error'));

      await expect(port.getPendingStepExecutions()).rejects.toThrow('Network error');
    });
  });
});
