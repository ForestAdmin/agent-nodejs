import type { ServerHydratedWorkflowRun } from '../../src/adapters/server-types';
import type { CollectionSchema } from '../../src/types/record';

import { ServerUtils } from '@forestadmin/forestadmin-client';

import ForestServerWorkflowPort from '../../src/adapters/forest-server-workflow-port';

jest.mock('@forestadmin/forestadmin-client', () => ({
  ServerUtils: { query: jest.fn() },
}));

const mockQuery = ServerUtils.query as jest.Mock;

const options = { envSecret: 'env-secret-123', forestServerUrl: 'https://api.forestadmin.com' };

function makeServerRun(overrides: Partial<ServerHydratedWorkflowRun> = {}): ServerHydratedWorkflowRun {
  return {
    id: 42,
    workflowId: 'wf-1',
    collectionId: '11',
    collectionName: 'customers',
    selectedRecordId: '123',
    bpmnVersion: '1.0',
    runState: 'running',
    workflowHistory: [
      {
        stepName: 'step-a',
        stepIndex: 0,
        done: false,
        stepDefinition: {
          type: 'task',
          taskType: 'get-data',
          title: 'Task',
          prompt: 'do it',
          outgoing: { stepId: 'next', buttonText: null },
        },
      },
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    userId: 7,
    renderingId: 3,
    userProfile: {
      id: 7,
      email: 'alban@forestadmin.com',
      firstName: 'Alban',
      lastName: 'Bertolini',
      team: 'team-a',
      renderingId: 3,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    },
    ...overrides,
  };
}

describe('ForestServerWorkflowPort', () => {
  let port: ForestServerWorkflowPort;

  beforeEach(() => {
    jest.clearAllMocks();
    port = new ForestServerWorkflowPort(options);
  });

  describe('getPendingStepExecutions', () => {
    it('should call the pending-run route and transform runs into pending step executions', async () => {
      mockQuery.mockResolvedValue([makeServerRun()]);

      const result = await port.getPendingStepExecutions();

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/pending-run',
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        runId: '42',
        stepId: 'step-a',
        baseRecordRef: { collectionName: 'customers', recordId: ['123'] },
      });
    });

    it('should filter out runs with no pending step', async () => {
      const doneRun = makeServerRun({
        workflowHistory: [
          {
            stepName: 'done-step',
            stepIndex: 0,
            done: true,
            stepDefinition: {
              type: 'task',
              taskType: 'get-data',
              title: 't',
              prompt: 'p',
              outgoing: { stepId: 'x', buttonText: null },
            },
          },
        ],
      });
      mockQuery.mockResolvedValue([doneRun, makeServerRun({ id: 100 })]);

      const result = await port.getPendingStepExecutions();

      expect(result).toHaveLength(1);
      expect(result[0].runId).toBe('100');
    });
  });

  describe('getPendingStepExecutionsForRun', () => {
    it('should call the available-run route with the runId in the path', async () => {
      mockQuery.mockResolvedValue(makeServerRun({ id: 42 }));

      const result = await port.getPendingStepExecutionsForRun('42');

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/available-run/42',
      );
      expect(result?.runId).toBe('42');
    });

    it('should encode special characters in the runId path segment', async () => {
      mockQuery.mockResolvedValue(makeServerRun());

      await port.getPendingStepExecutionsForRun('run/42 special');

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/available-run/run%2F42%20special',
      );
    });

    it('should return null when server returns null', async () => {
      mockQuery.mockResolvedValue(null);

      const result = await port.getPendingStepExecutionsForRun('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null when the run has no pending step', async () => {
      const doneRun = makeServerRun({
        workflowHistory: [
          {
            stepName: 'done',
            stepIndex: 0,
            done: true,
            stepDefinition: {
              type: 'task',
              taskType: 'get-data',
              title: 't',
              prompt: 'p',
              outgoing: { stepId: 'x', buttonText: null },
            },
          },
        ],
      });
      mockQuery.mockResolvedValue(doneRun);

      const result = await port.getPendingStepExecutionsForRun('42');

      expect(result).toBeNull();
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

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/collection-schema/users',
      );
      expect(result).toEqual(collectionSchema);
    });

    it('should encode special characters in the collection name', async () => {
      mockQuery.mockResolvedValue({
        collectionName: 'a/b',
        collectionDisplayName: 'A/B',
        primaryKeyFields: [],
        fields: [],
        actions: [],
      });

      await port.getCollectionSchema('a/b');

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/collection-schema/a%2Fb',
      );
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
    it('should propagate errors from getPendingStepExecutions', async () => {
      mockQuery.mockRejectedValue(new Error('Network error'));

      await expect(port.getPendingStepExecutions()).rejects.toThrow('Network error');
    });

    it('should propagate errors from getPendingStepExecutionsForRun', async () => {
      mockQuery.mockRejectedValue(new Error('Network error'));

      await expect(port.getPendingStepExecutionsForRun('run-1')).rejects.toThrow('Network error');
    });
  });
});
