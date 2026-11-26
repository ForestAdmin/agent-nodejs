import type { AgentDispatcher } from '@forestadmin/agent-client';

import { ActivityLogSource, createRemoteAgentClient } from '@forestadmin/agent-client';

import createAgentActionClient from '../../src/action/agent-action-client';
import { createHttpTransport } from '../../src/agent/agent-transport';
import createInProcessTransport from '../../src/agent/in-process-transport';

function transportTo(agentUrl: string, timeoutMs?: number) {
  return createHttpTransport({ agentUrl, timeoutMs });
}

jest.mock('@forestadmin/agent-client', () => ({
  ...jest.requireActual('@forestadmin/agent-client'),
  createRemoteAgentClient: jest.fn(),
}));

const createRemoteAgentClientMock = createRemoteAgentClient as jest.Mock;

describe('createAgentActionClient', () => {
  beforeEach(() => {
    createRemoteAgentClientMock.mockReset();
  });

  it('loads the action via createRemoteAgentClient().collection(name).action(name, { recordIds, timezone })', async () => {
    const loadedAction = { tag: 'action' };
    const actionFn = jest.fn(async () => loadedAction);
    const collectionFn = jest.fn(() => ({ action: actionFn }));
    createRemoteAgentClientMock.mockReturnValue({ collection: collectionFn });

    const actionEndpoints = { users: { approve: {} } } as never;
    const client = createAgentActionClient({
      transport: transportTo('https://agent.example.com'),
      token: 'jwt-token',
      actionEndpoints,
    });
    const result = await client.loadAction({
      collection: 'users',
      actionName: 'approve',
      recordIds: ['1', '2'],
      timezone: 'America/New_York',
    });

    expect(createRemoteAgentClientMock).toHaveBeenCalledWith({
      url: 'https://agent.example.com',
      timeoutMs: undefined,
      token: 'jwt-token',
      actionEndpoints,
    });
    expect(collectionFn).toHaveBeenCalledWith('users');
    expect(actionFn).toHaveBeenCalledWith('approve', {
      recordIds: ['1', '2'],
      timezone: 'America/New_York',
    });
    expect(result).toBe(loadedAction);
  });

  it('should give the client the configured timeout', () => {
    createRemoteAgentClientMock.mockReturnValue({
      collection: jest.fn(() => ({ action: jest.fn() })),
    });

    createAgentActionClient({
      transport: transportTo('https://agent', 2500),
      token: 'tok',
      actionEndpoints: {} as never,
    });

    expect(createRemoteAgentClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://agent', timeoutMs: 2500 }),
    );
  });

  it('executes through agent-client with the Forest server connection, the approval message and the timeout', async () => {
    const executeAction = jest.fn(async () => ({ success: 'done' }));
    createRemoteAgentClientMock.mockReturnValue({ collection: jest.fn(() => ({ executeAction })) });
    const activityLog = {
      forestServer: { serverUrl: 'https://api.forestadmin.com', serverToken: 'st', renderingId: 1 },
      activityLog: { source: ActivityLogSource.BFF },
    };
    const beforeCall = jest.fn();
    const fill = jest.fn();

    await createAgentActionClient({
      transport: transportTo('https://agent.example.com'),
      token: 'jwt-token',
      actionEndpoints: {} as never,
      activityLog,
    }).executeAction({
      collection: 'users',
      actionName: 'approve',
      recordIds: ['1'],
      timezone: 'UTC',
      approvalRequestMessage: 'why',
      maxTimeAllowed: 30_000,
      beforeCall,
      fill,
    });

    expect(createRemoteAgentClientMock).toHaveBeenCalledWith(expect.objectContaining(activityLog));
    expect(executeAction).toHaveBeenCalledWith('approve', {
      recordIds: ['1'],
      timezone: 'UTC',
      approvalRequestMessage: 'why',
      maxTimeAllowed: 30_000,
      fill,
      activityLog: { beforeCall },
    });
  });

  it('executes the action in the timezone of the request', async () => {
    createRemoteAgentClientMock.mockImplementation(
      jest.requireActual('@forestadmin/agent-client').createRemoteAgentClient,
    );
    const dispatcher: AgentDispatcher & { request: jest.Mock } = {
      request: jest.fn().mockResolvedValue({ status: 200, body: { success: 'done' } }),
    };

    await createAgentActionClient({
      transport: createInProcessTransport({ dispatcher }),
      token: 'jwt-token',
      actionEndpoints: {
        users: {
          approve: {
            id: 'users-approve',
            name: 'approve',
            endpoint: '/forest/_actions/users/0/approve',
            hooks: { load: false, change: [] },
            fields: [],
          },
        },
      } as never,
    }).executeAction({
      collection: 'users',
      actionName: 'approve',
      recordIds: ['1'],
      timezone: 'America/New_York',
      beforeCall: async () => undefined,
      fill: async () => undefined,
    });

    expect(dispatcher.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'post',
        path: '/forest/_actions/users/0/approve',
        query: { timezone: 'America/New_York' },
      }),
    );
  });
});
