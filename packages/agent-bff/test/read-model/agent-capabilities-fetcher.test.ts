import { HttpRequester, createRemoteAgentClient } from '@forestadmin/agent-client';

import createAgentCapabilitiesFetcher from '../../src/read-model/agent-capabilities-fetcher';

jest.mock('@forestadmin/agent-client');

const createRemoteAgentClientMock = createRemoteAgentClient as jest.Mock;
const mockedHttpRequester = jest.mocked(HttpRequester);

describe('createAgentCapabilitiesFetcher', () => {
  const query = jest.fn();

  beforeEach(() => {
    query.mockReset();
    createRemoteAgentClientMock.mockReset();
    mockedHttpRequester.mockReset();
    mockedHttpRequester.mockImplementation(() => ({ query } as unknown as HttpRequester));
  });

  it('should build a client for the agent url/token and fetch capabilities per collection', async () => {
    const capabilities = jest.fn().mockResolvedValue({ fields: [{ name: 'email' }] });
    const collection = jest.fn().mockReturnValue({ capabilities });
    createRemoteAgentClientMock.mockReturnValue({ collection });

    const fetcher = createAgentCapabilitiesFetcher({ agentUrl: 'https://agent', token: 'tok' });
    const result = await fetcher('users');

    expect(HttpRequester).toHaveBeenCalledWith('tok', { url: 'https://agent' });
    expect(createRemoteAgentClientMock).toHaveBeenCalledWith({
      url: 'https://agent',
      token: 'tok',
      httpRequester: expect.objectContaining({ query }),
    });
    expect(collection).toHaveBeenCalledWith('users');
    expect(capabilities).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ fields: [{ name: 'email' }] });
  });

  it('should inject an HttpRequester that applies the configured timeout', async () => {
    createRemoteAgentClientMock.mockReturnValue({
      collection: jest
        .fn()
        .mockReturnValue({ capabilities: jest.fn().mockResolvedValue({ fields: [] }) }),
    });

    await createAgentCapabilitiesFetcher({
      agentUrl: 'https://agent',
      token: 'tok',
      timeoutMs: 2500,
    })('users');

    const httpRequester = createRemoteAgentClientMock.mock.calls[0][0]
      .httpRequester as HttpRequester;
    await httpRequester.query({ method: 'get', path: '/forest/users/capabilities' });

    expect(query).toHaveBeenCalledWith({
      method: 'get',
      path: '/forest/users/capabilities',
      maxTimeAllowed: 2500,
    });
  });
});
