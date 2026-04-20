import type { ServerHydratedWorkflowRun } from '../../src/adapters/server-types';
import type { CollectionSchema } from '../../src/types/record';
import type { StepOutcome } from '../../src/types/step-outcome';

import { ServerUtils } from '@forestadmin/forestadmin-client';

import ForestServerWorkflowPort from '../../src/adapters/forest-server-workflow-port';

jest.mock('@forestadmin/forestadmin-client', () => ({
  ServerUtils: { query: jest.fn() },
}));

const mockQuery = ServerUtils.query as jest.Mock;

const options = { envSecret: 'env-secret-123', forestServerUrl: 'https://api.forestadmin.com' };

function makeRun(overrides: Partial<ServerHydratedWorkflowRun> = {}): ServerHydratedWorkflowRun {
  return {
    id: 42,
    workflowId: 'wf-1',
    collectionId: 'col-1',
    collectionName: 'users',
    selectedRecordId: '7',
    bpmnVersion: '1.0',
    runState: 'started',
    workflowHistory: [
      {
        stepName: 'step-1',
        stepIndex: 0,
        done: false,
        stepDefinition: {
          type: 'condition',
          title: 'Decide',
          prompt: 'pick one',
          outgoing: [
            { stepId: 'next-a', buttonText: 'A', answer: 'Yes' },
            { stepId: 'next-b', buttonText: 'B', answer: 'No' },
          ],
        },
      },
    ],
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
    userId: 1,
    renderingId: 1,
    userProfile: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      team: 'admin',
      renderingId: 1,
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
    it('calls the pending-run route and maps runs to PendingStepExecution', async () => {
      mockQuery.mockResolvedValue([makeRun()]);

      const result = await port.getPendingStepExecutions();

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/pending-run',
      );
      expect(result).toHaveLength(1);
      expect(result[0].runId).toBe('42');
      expect(result[0].stepId).toBe('step-1');
    });

    it('filters out runs with no pending step', async () => {
      const terminalRun = makeRun({
        workflowHistory: [
          {
            stepName: 'step-1',
            stepIndex: 0,
            done: true,
            stepDefinition: {
              type: 'condition',
              title: 'Done',
              prompt: '',
              outgoing: [{ stepId: 'next', buttonText: 'ok', answer: 'ok' }],
            },
          },
        ],
      });
      mockQuery.mockResolvedValue([terminalRun]);

      const result = await port.getPendingStepExecutions();

      expect(result).toEqual([]);
    });

    it('skips malformed runs and keeps valid ones in the same batch', async () => {
      const logger = { error: jest.fn(), info: jest.fn() };
      const portWithLogger = new ForestServerWorkflowPort({ ...options, logger });
      const validRun = makeRun({ id: 42 });
      const malformedRun = makeRun({ id: 99, collectionName: null });
      mockQuery.mockResolvedValue([malformedRun, validRun]);

      const result = await portWithLogger.getPendingStepExecutions();

      expect(result).toHaveLength(1);
      expect(result[0].runId).toBe('42');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to hydrate pending run — skipping',
        expect.objectContaining({ runId: 99 }),
      );
    });
  });

  describe('getPendingStepExecutionsForRun', () => {
    it('calls the available-run route with the encoded runId', async () => {
      mockQuery.mockResolvedValue(makeRun({ id: 42 }));

      const result = await port.getPendingStepExecutionsForRun('run-42');

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/available-run/run-42',
      );
      expect(result?.runId).toBe('42');
    });

    it('encodes special characters in the runId', async () => {
      mockQuery.mockResolvedValue(makeRun());

      await port.getPendingStepExecutionsForRun('run/42 special');

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/available-run/run%2F42%20special',
      );
    });

    it('returns null when the server returns null (no pending run)', async () => {
      mockQuery.mockResolvedValue(null);

      const result = await port.getPendingStepExecutionsForRun('run-42');

      expect(result).toBeNull();
    });
  });

  describe('updateStepExecution', () => {
    it('posts the mapped body for a condition success outcome', async () => {
      mockQuery.mockResolvedValue(undefined);
      const stepOutcome: StepOutcome = {
        type: 'condition',
        stepId: 'step-1',
        stepIndex: 0,
        status: 'success',
        selectedOption: 'optionA',
      };

      await port.updateStepExecution('42', stepOutcome);

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'post',
        '/api/workflow-orchestrator/update-step',
        {},
        {
          runId: 42,
          stepUpdate: {
            stepIndex: 0,
            attributes: {
              done: true,
              context: { status: 'success', selectedOption: 'optionA' },
            },
          },
          executionStatus: { type: 'success' },
        },
      );
    });

    it('posts the mapped body for an error outcome', async () => {
      mockQuery.mockResolvedValue(undefined);
      const stepOutcome: StepOutcome = {
        type: 'record',
        stepId: 'step-1',
        stepIndex: 1,
        status: 'error',
        error: 'boom',
      };

      await port.updateStepExecution('42', stepOutcome);

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'post',
        '/api/workflow-orchestrator/update-step',
        {},
        {
          runId: 42,
          stepUpdate: {
            stepIndex: 1,
            attributes: {
              done: true,
              context: { status: 'error', error: 'boom' },
            },
          },
          executionStatus: { type: 'error', message: 'boom' },
        },
      );
    });

    it('posts the mapped body for an awaiting-input outcome', async () => {
      mockQuery.mockResolvedValue(undefined);
      const stepOutcome: StepOutcome = {
        type: 'record',
        stepId: 'step-1',
        stepIndex: 2,
        status: 'awaiting-input',
      };

      await port.updateStepExecution('42', stepOutcome);

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'post',
        '/api/workflow-orchestrator/update-step',
        {},
        {
          runId: 42,
          stepUpdate: {
            stepIndex: 2,
            attributes: {
              done: false,
              context: { status: 'awaiting-input' },
            },
          },
          executionStatus: { type: 'awaiting-input' },
        },
      );
    });
  });

  describe('getCollectionSchema', () => {
    const collectionSchema: CollectionSchema = {
      collectionName: 'users',
      collectionDisplayName: 'Users',
      primaryKeyFields: ['id'],
      fields: [],
      actions: [],
    };

    it('fetches the collection schema with runId as query param', async () => {
      mockQuery.mockResolvedValue(collectionSchema);

      const result = await port.getCollectionSchema('users', '42');

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/collection-schema/users?runId=42',
      );
      expect(result).toEqual(collectionSchema);
    });

    it('encodes special characters in collectionName and runId', async () => {
      mockQuery.mockResolvedValue(collectionSchema);

      await port.getCollectionSchema('users/admin', 'run/42');

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/collection-schema/users%2Fadmin?runId=run%2F42',
      );
    });
  });

  describe('getMcpServerConfigs', () => {
    it('fetches mcp server configs', async () => {
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
    const user = {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      team: 'admin',
      renderingId: 1,
      role: 'admin',
      permissionLevel: 'admin',
      tags: {},
    };

    it('calls the access-check route with runId in the path and userId in the query', async () => {
      mockQuery.mockResolvedValue({ hasAccess: true });

      await port.hasRunAccess('run-42', user);

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/run/run-42/access-check?userId=1',
      );
    });

    it('returns true when the server responds with hasAccess: true', async () => {
      mockQuery.mockResolvedValue({ hasAccess: true });

      const result = await port.hasRunAccess('run-42', user);

      expect(result).toBe(true);
    });

    it('returns false when the server responds with hasAccess: false', async () => {
      mockQuery.mockResolvedValue({ hasAccess: false });

      const result = await port.hasRunAccess('run-42', user);

      expect(result).toBe(false);
    });

    it('returns false (fail-secure) when the server responds with a malformed body', async () => {
      mockQuery.mockResolvedValue({});

      const result = await port.hasRunAccess('run-42', user);

      expect(result).toBe(false);
    });

    it('encodes special characters in the runId', async () => {
      mockQuery.mockResolvedValue({ hasAccess: true });

      await port.hasRunAccess('run/42 special', user);

      expect(mockQuery).toHaveBeenCalledWith(
        options,
        'get',
        '/api/workflow-orchestrator/run/run%2F42%20special/access-check?userId=1',
      );
    });
  });

  describe('error propagation', () => {
    it('propagates errors from ServerUtils.query on getPendingStepExecutions', async () => {
      mockQuery.mockRejectedValue(new Error('Network error'));

      await expect(port.getPendingStepExecutions()).rejects.toThrow('Network error');
    });

    it('propagates errors from getPendingStepExecutionsForRun', async () => {
      mockQuery.mockRejectedValue(new Error('Network error'));

      await expect(port.getPendingStepExecutionsForRun('run-1')).rejects.toThrow('Network error');
    });

    it('propagates errors from hasRunAccess', async () => {
      mockQuery.mockRejectedValue(new Error('Network error'));

      await expect(
        port.hasRunAccess('run-42', {
          id: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          team: 'admin',
          renderingId: 1,
          role: 'admin',
          permissionLevel: 'admin',
          tags: {},
        }),
      ).rejects.toThrow('Network error');
    });

    it('propagates errors from updateStepExecution', async () => {
      mockQuery.mockRejectedValue(new Error('Network error'));
      const outcome: StepOutcome = {
        type: 'guidance',
        stepId: 'step-1',
        stepIndex: 0,
        status: 'success',
      };

      await expect(port.updateStepExecution('42', outcome)).rejects.toThrow('Network error');
    });
  });
});
