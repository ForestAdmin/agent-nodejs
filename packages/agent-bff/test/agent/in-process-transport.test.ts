import type { AgentDispatcher } from '../../src/agent/in-process-transport';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

import createInProcessTransport from '../../src/agent/in-process-transport';

describe('createInProcessTransport', () => {
  it('should dispatch with the bearer token and the configured timeout', async () => {
    const dispatcher: AgentDispatcher & { request: jest.Mock } = {
      request: jest.fn().mockResolvedValue({ status: 200, body: { count: 0 } }),
    };
    const transport = createInProcessTransport({ dispatcher, timeoutMs: 2500 });

    await createRemoteAgentClient({ ...transport, token: 'tok' })
      .collection('users')
      .count();

    expect(dispatcher.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'get',
        path: '/forest/users/count',
        headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        timeoutMs: 2500,
      }),
    );
  });
});
