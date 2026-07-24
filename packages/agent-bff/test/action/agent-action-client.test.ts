import { createRemoteAgentClient } from '@forestadmin/agent-client';

import createAgentActionClient from '../../src/action/agent-action-client';

jest.mock('@forestadmin/agent-client', () => ({ createRemoteAgentClient: jest.fn() }));

const createRemoteAgentClientMock = createRemoteAgentClient as jest.Mock;

describe('createAgentActionClient', () => {
  it('loads the action via createRemoteAgentClient().collection(name).action(name, { recordIds })', async () => {
    const loadedAction = { tag: 'action' };
    const actionFn = jest.fn(async () => loadedAction);
    const collectionFn = jest.fn(() => ({ action: actionFn }));
    createRemoteAgentClientMock.mockReturnValue({ collection: collectionFn });

    const actionEndpoints = { users: { approve: {} } } as never;
    const client = createAgentActionClient({
      agentUrl: 'https://agent.example.com',
      token: 'agent-jwt',
      actionEndpoints,
    });
    const result = await client.loadAction('users', 'approve', ['1', '2']);

    expect(createRemoteAgentClientMock).toHaveBeenCalledWith({
      url: 'https://agent.example.com',
      token: 'agent-jwt',
      actionEndpoints,
    });
    expect(collectionFn).toHaveBeenCalledWith('users');
    expect(actionFn).toHaveBeenCalledWith('approve', { recordIds: ['1', '2'] });
    expect(result).toBe(loadedAction);
  });
});
