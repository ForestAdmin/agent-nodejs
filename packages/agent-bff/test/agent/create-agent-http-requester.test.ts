import { HttpRequester } from '@forestadmin/agent-client';

import createAgentHttpRequester from '../../src/agent/create-agent-http-requester';

jest.mock('@forestadmin/agent-client');

const mockedHttpRequester = jest.mocked(HttpRequester);

describe('createAgentHttpRequester', () => {
  const query = jest.fn();

  beforeEach(() => {
    query.mockReset();
    query.mockResolvedValue([]);
    mockedHttpRequester.mockReset();
    mockedHttpRequester.mockImplementation(() => ({ query } as unknown as HttpRequester));
  });

  it('should build a plain HttpRequester when no timeout is configured', () => {
    const requester = createAgentHttpRequester('tok', 'https://agent.example.com');

    expect(HttpRequester).toHaveBeenCalledWith('tok', { url: 'https://agent.example.com' });
    expect(requester.query).toBe(query);
  });

  it('should default maxTimeAllowed to the configured timeout on query', async () => {
    const requester = createAgentHttpRequester('tok', 'https://agent', 2500);

    await requester.query({ method: 'get', path: '/forest/users' });

    expect(query).toHaveBeenCalledWith({
      method: 'get',
      path: '/forest/users',
      maxTimeAllowed: 2500,
    });
  });

  it('should keep an explicit per-call maxTimeAllowed on query', async () => {
    const requester = createAgentHttpRequester('tok', 'https://agent', 2500);

    await requester.query({ method: 'get', path: '/forest/users', maxTimeAllowed: 400 });

    expect(query).toHaveBeenCalledWith({
      method: 'get',
      path: '/forest/users',
      maxTimeAllowed: 400,
    });
  });
});
