import { createRemoteAgentClient } from '@forestadmin/agent-client';

import createAgentCapabilitiesFetcher from '../../src/read-model/agent-capabilities-fetcher';

jest.mock('@forestadmin/agent-client');

describe('createAgentCapabilitiesFetcher', () => {
  it('should build a client for the agent url/token and fetch capabilities per collection', async () => {
    const capabilities = jest.fn().mockResolvedValue({ fields: [{ name: 'email' }] });
    const collection = jest.fn().mockReturnValue({ capabilities });
    (createRemoteAgentClient as jest.Mock).mockReturnValue({ collection });

    const fetcher = createAgentCapabilitiesFetcher({ agentUrl: 'https://agent', token: 'tok' });
    const result = await fetcher('users');

    expect(createRemoteAgentClient).toHaveBeenCalledWith({
      url: 'https://agent',
      token: 'tok',
      timeoutMs: undefined,
    });
    expect(collection).toHaveBeenCalledWith('users');
    expect(capabilities).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ fields: [{ name: 'email' }] });
  });

  it('should pass the configured timeout down to the agent client', async () => {
    const capabilities = jest.fn().mockResolvedValue({ fields: [] });
    (createRemoteAgentClient as jest.Mock).mockReturnValue({
      collection: jest.fn().mockReturnValue({ capabilities }),
    });

    await createAgentCapabilitiesFetcher({
      agentUrl: 'https://agent',
      token: 'tok',
      timeoutMs: 2500,
    })('users');

    expect(createRemoteAgentClient).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 2500 }),
    );
  });
});
