import { HttpRequester, createRemoteAgentClient } from '@forestadmin/agent-client';

import createAgentCapabilitiesFetcher from '../../src/read-model/agent-capabilities-fetcher';

jest.mock('@forestadmin/agent-client');

const createRemoteAgentClientMock = createRemoteAgentClient as jest.Mock;
const mockedHttpRequester = jest.mocked(HttpRequester);

describe('createAgentCapabilitiesFetcher', () => {
  const query = jest.fn();
  const stream = jest.fn();

  beforeEach(() => {
    query.mockReset();
    createRemoteAgentClientMock.mockReset();
    mockedHttpRequester.mockReset();
    mockedHttpRequester.mockImplementation(() => ({ query, stream } as unknown as HttpRequester));
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
      httpRequester: expect.objectContaining({ query: expect.any(Function) }),
    });
    expect(collection).toHaveBeenCalledWith('users');
    expect(capabilities).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ fields: [{ name: 'email' }] });
  });

  it('should reuse one client for a borrowed token, which cannot be renewed', async () => {
    const collection = jest
      .fn()
      .mockReturnValue({ capabilities: jest.fn().mockResolvedValue({ fields: [] }) });
    createRemoteAgentClientMock.mockReturnValue({ collection });

    const fetcher = createAgentCapabilitiesFetcher({ agentUrl: 'https://agent', token: 'tok' });
    await fetcher('users');
    await fetcher('orders');

    expect(createRemoteAgentClientMock).toHaveBeenCalledTimes(1);
  });

  it('should sign a fresh token per fetch when given a factory, so a long fan-out cannot expire', async () => {
    const collection = jest
      .fn()
      .mockReturnValue({ capabilities: jest.fn().mockResolvedValue({ fields: [] }) });
    createRemoteAgentClientMock.mockReturnValue({ collection });
    let minted = 0;

    const fetcher = createAgentCapabilitiesFetcher({
      agentUrl: 'https://agent',
      token: () => {
        minted += 1;

        return `tok-${minted}`;
      },
    });
    await fetcher('users');
    await fetcher('orders');

    expect(minted).toBe(2);
    expect(createRemoteAgentClientMock.mock.calls.map(call => call[0].token)).toEqual([
      'tok-1',
      'tok-2',
    ]);
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
