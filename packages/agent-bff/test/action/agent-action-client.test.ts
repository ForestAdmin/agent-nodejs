import { HttpRequester, createRemoteAgentClient } from '@forestadmin/agent-client';

import createAgentActionClient from '../../src/action/agent-action-client';

jest.mock('@forestadmin/agent-client');

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
      agentUrl: 'https://agent.example.com',
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
      agentUrl: 'https://agent',
      token: 'tok',
      actionEndpoints: {} as never,
      timeoutMs: 2500,
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
});
