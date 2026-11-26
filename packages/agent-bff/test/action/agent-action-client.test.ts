import {
  ActivityLogSource,
  HttpRequester,
  createRemoteAgentClient,
} from '@forestadmin/agent-client';

import createAgentActionClient from '../../src/action/agent-action-client';
import { createHttpTransport } from '../../src/agent/agent-transport';

function transportTo(agentUrl: string, timeoutMs?: number) {
  return createHttpTransport({ agentUrl, timeoutMs });
}

jest.mock('@forestadmin/agent-client', () => ({
  ...jest.requireActual('@forestadmin/agent-client'),
  HttpRequester: jest.fn(),
  createRemoteAgentClient: jest.fn(),
}));

const createRemoteAgentClientMock = createRemoteAgentClient as jest.Mock;
const mockedHttpRequester = jest.mocked(HttpRequester);

describe('createAgentActionClient', () => {
  const query = jest.fn();
  const stream = jest.fn();

  beforeEach(() => {
    query.mockReset();
    createRemoteAgentClientMock.mockReset();
    mockedHttpRequester.mockReset();
    mockedHttpRequester.mockImplementation(() => ({ query, stream } as unknown as HttpRequester));
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

    expect(HttpRequester).toHaveBeenCalledWith('jwt-token', { url: 'https://agent.example.com' });
    expect(createRemoteAgentClientMock).toHaveBeenCalledWith({
      url: 'https://agent.example.com',
      token: 'jwt-token',
      actionEndpoints,
      httpRequester: expect.objectContaining({ query: expect.any(Function) }),
    });
    expect(collectionFn).toHaveBeenCalledWith('users');
    expect(actionFn).toHaveBeenCalledWith('approve', {
      recordIds: ['1', '2'],
      timezone: 'America/New_York',
    });
    expect(result).toBe(loadedAction);
  });

  it('should inject an HttpRequester that applies the configured timeout', async () => {
    createRemoteAgentClientMock.mockReturnValue({
      collection: jest.fn(() => ({ action: jest.fn() })),
    });

    createAgentActionClient({
      transport: transportTo('https://agent', 2500),
      token: 'tok',
      actionEndpoints: {} as never,
    });

    const httpRequester = createRemoteAgentClientMock.mock.calls[0][0]
      .httpRequester as HttpRequester;
    await httpRequester.query({ method: 'get', path: '/forest/_actions/users/0/approve' });

    expect(query).toHaveBeenCalledWith({
      method: 'get',
      path: '/forest/_actions/users/0/approve',
      maxTimeAllowed: 2500,
    });
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
    const isOutcomeUnknown = jest.fn();

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
      isOutcomeUnknown,
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
      activityLog: { beforeCall, isOutcomeUnknown },
    });
  });

  it('executes the action in the timezone of the request', async () => {
    createRemoteAgentClientMock.mockImplementation(
      jest.requireActual('@forestadmin/agent-client').createRemoteAgentClient,
    );
    query.mockResolvedValue({ success: 'done' });

    await createAgentActionClient({
      transport: transportTo('https://agent.example.com'),
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
      isOutcomeUnknown: () => false,
      beforeCall: async () => undefined,
      fill: async () => undefined,
    });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'post',
        path: '/forest/_actions/users/0/approve',
        query: { timezone: 'America/New_York' },
      }),
    );
  });
});
