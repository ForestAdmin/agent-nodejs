import { HttpRequester } from '@forestadmin/agent-client';

import createAgentDataClient from '../../src/data/agent-data-client';

jest.mock('@forestadmin/agent-client');

const mockedHttpRequester = jest.mocked(HttpRequester);

describe('createAgentDataClient', () => {
  const query = jest.fn();

  beforeEach(() => {
    query.mockReset();
    mockedHttpRequester.mockReset();
    mockedHttpRequester.mockImplementation(() => ({ query } as unknown as HttpRequester));
  });

  it('should build the requester with the agent url and token', () => {
    createAgentDataClient({ agentUrl: 'https://agent.example.com', token: 'tok' });

    expect(HttpRequester).toHaveBeenCalledWith('tok', { url: 'https://agent.example.com' });
  });

  it('should query the list endpoint (deserialized) for the given collection', async () => {
    query.mockResolvedValue([{ id: '1' }]);
    const client = createAgentDataClient({ agentUrl: 'https://agent', token: 'tok' });

    const result = await client.list('users', { timezone: 'Europe/Paris', filters: '{}' });

    expect(query).toHaveBeenCalledWith({
      method: 'get',
      path: '/forest/users',
      query: { timezone: 'Europe/Paris', filters: '{}' },
    });
    expect(result).toEqual([{ id: '1' }]);
  });

  it('should query the count endpoint with skipDeserialization to read the raw payload', async () => {
    query.mockResolvedValue({ meta: { count: 'deactivated' } });
    const client = createAgentDataClient({ agentUrl: 'https://agent', token: 'tok' });

    const result = await client.countRaw('users', { timezone: 'Europe/Paris' });

    expect(query).toHaveBeenCalledWith({
      method: 'get',
      path: '/forest/users/count',
      query: { timezone: 'Europe/Paris' },
      skipDeserialization: true,
    });
    expect(result).toEqual({ meta: { count: 'deactivated' } });
  });
});
