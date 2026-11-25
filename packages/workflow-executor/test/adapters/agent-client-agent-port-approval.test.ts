import type { StepUser } from '../../src/types/execution-context';

import {
  ActivityLogSource,
  AgentHttpError,
  HttpRequester,
  drainActivityLogs,
} from '@forestadmin/agent-client';
import { ActivityLogsService, ServerUtils } from '@forestadmin/forestadmin-client';

import AgentClientAgentPort from '../../src/adapters/agent-client-agent-port';
import SchemaCache from '../../src/schema-cache';

jest.mock('@forestadmin/forestadmin-client', () => ({
  ...jest.requireActual('@forestadmin/forestadmin-client'),
  ActivityLogsService: jest.fn(),
}));

const FOREST_SERVER_URL = 'https://api.forestadmin.com';
const FOREST_SERVER_TOKEN = 'forest-server-token';
const WORKFLOW = { runId: 'run-1', name: 'Onboarding' };

const user: StepUser = {
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

describe('AgentClientAgentPort on an action that needs an approval', () => {
  const forestServer = jest.spyOn(ServerUtils, 'queryWithBearerToken');
  const agent = jest.spyOn(HttpRequester.prototype, 'query');

  afterAll(() => {
    forestServer.mockRestore();
    agent.mockRestore();
  });

  it('cancels the action entry and records the approval request as a createApproval entry', async () => {
    const service = {
      createActivityLog: jest.fn(async ({ action }: { action: string }) => ({
        id: `log-of-${action}`,
        attributes: { index: 'idx' },
      })),
      updateActivityLogStatus: jest.fn(async () => undefined),
    };
    (ActivityLogsService as jest.Mock).mockImplementation(() => service);
    forestServer.mockResolvedValue({ data: { id: 'req_42' } });
    agent.mockRejectedValue(
      new AgentHttpError(403, { errors: [{ name: 'CustomActionRequiresApprovalError' }] }),
    );

    const schemaCache = new SchemaCache();
    schemaCache.set(1, 'users', {
      collectionName: 'users',
      collectionId: 'col-users',
      collectionDisplayName: 'Users',
      primaryKeyFields: ['id'],
      fields: [{ fieldName: 'id', displayName: 'id', isRelationship: false }],
      actions: [
        {
          name: 'archive',
          displayName: 'Archive',
          endpoint: '/forest/actions/archive',
          hooks: { load: false, change: [] },
          fields: [],
        },
      ],
    });
    const port = new AgentClientAgentPort({
      agentUrl: 'http://localhost:3310',
      authSecret: 'test-secret',
      schemaCache,
      forestServerUrl: FOREST_SERVER_URL,
    });

    const result = await port.executeAction(
      { collection: 'users', action: 'archive', id: [42] },
      { user, forestServerToken: FOREST_SERVER_TOKEN },
      {
        context: {
          forestServer: {
            serverUrl: FOREST_SERVER_URL,
            serverToken: FOREST_SERVER_TOKEN,
            renderingId: user.renderingId,
          },
          activityLog: {
            source: ActivityLogSource.WorkflowExecutor,
            workflow: WORKFLOW,
            collectionIdOf: async () => 'col-users',
          },
        },
      },
    );
    await drainActivityLogs();

    expect(result).toEqual({ approvalRequested: true, approvalRequest: { id: 'req_42' } });
    expect(service.createActivityLog).toHaveBeenCalledTimes(2);
    expect(service.createActivityLog).toHaveBeenLastCalledWith({
      forestServerToken: FOREST_SERVER_TOKEN,
      renderingId: '1',
      action: 'createApproval',
      type: 'write',
      collectionName: 'col-users',
      recordIds: ['42'],
      label: 'requested an approval for the action "archive"',
      workflow: WORKFLOW,
    });
    expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        activityLog: expect.objectContaining({ id: 'log-of-action' }),
        status: 'canceled',
      }),
    );
    expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        activityLog: expect.objectContaining({ id: 'log-of-createApproval' }),
        status: 'completed',
      }),
    );
  });
});
