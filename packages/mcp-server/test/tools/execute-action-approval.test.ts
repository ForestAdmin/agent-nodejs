import type { ForestServerClient } from '../../src/http-client';
import type { InProcessAgentDispatcher } from '../../src/in-process-agent-dispatcher';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { drainActivityLogs } from '@forestadmin/agent-client';
import { ActivityLogsService, ServerUtils } from '@forestadmin/forestadmin-client';

import declareExecuteActionTool from '../../src/tools/execute-action';
import { fetchForestSchema } from '../../src/utils/schema-fetcher';

jest.mock('../../src/utils/schema-fetcher');
jest.mock('@forestadmin/forestadmin-client', () => ({
  ...jest.requireActual('@forestadmin/forestadmin-client'),
  ActivityLogsService: jest.fn(),
}));

const FOREST_SERVER_TOKEN = 'forest-server-token';
const RENDERING_ID = 12;

describe('executeAction on an action that needs an approval', () => {
  const forestServer = jest.spyOn(ServerUtils, 'queryWithBearerToken');

  afterAll(() => forestServer.mockRestore());

  it('should cancel the action entry and record the approval request as a createApproval entry', async () => {
    const service = {
      createMcpActivityLog: jest.fn(async ({ action }: { action: string }) => ({
        id: `log-of-${action}`,
        attributes: { index: 'idx' },
      })),
      updateActivityLogStatus: jest.fn(async () => undefined),
    };
    (ActivityLogsService as jest.Mock).mockImplementation(() => service);
    forestServer.mockResolvedValue({ data: { id: 'req_42' } });
    jest.mocked(fetchForestSchema).mockResolvedValue({
      collections: [
        {
          name: 'users',
          actions: [
            {
              id: 'users-refund',
              name: 'refund',
              endpoint: '/forest/actions/refund',
              hooks: { load: false, change: [] },
              fields: [],
              layout: [],
            },
          ],
        },
      ],
    } as never);

    const agentDispatcher: InProcessAgentDispatcher = {
      request: async () => ({
        status: 403,
        body: { errors: [{ name: 'CustomActionRequiresApprovalError' }] },
        text: '',
      }),
    };
    let handler: (options: unknown, extra: unknown) => Promise<unknown>;
    const mcpServer = {
      registerTool: jest.fn((name, config, registered) => {
        handler = registered;
      }),
    } as unknown as McpServer;

    declareExecuteActionTool(mcpServer, {
      forestServerClient: {
        forestServerUrl: 'https://api.forestadmin.com',
      } as unknown as ForestServerClient,
      logger: jest.fn(),
      collectionNames: ['users'],
      agentDispatcher,
    });

    const result = await handler(
      { collectionName: 'users', actionName: 'refund', recordIds: [7] },
      {
        authInfo: {
          token: 'agent-token',
          extra: { forestServerToken: FOREST_SERVER_TOKEN, renderingId: RENDERING_ID },
        },
      },
    );
    await drainActivityLogs();

    expect(result).toEqual({
      content: [{ type: 'text', text: expect.stringContaining('Approval request id: req_42.') }],
    });
    expect(service.createMcpActivityLog).toHaveBeenCalledTimes(2);
    expect(service.createMcpActivityLog).toHaveBeenLastCalledWith({
      forestServerToken: FOREST_SERVER_TOKEN,
      renderingId: String(RENDERING_ID),
      action: 'createApproval',
      type: 'write',
      collectionName: 'users',
      recordIds: ['7'],
      label: 'requested an approval for the action "refund"',
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
