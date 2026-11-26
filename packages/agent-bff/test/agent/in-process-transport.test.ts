import type { AgentDispatcher } from '../../src/agent/in-process-transport';

import createInProcessTransport from '../../src/agent/in-process-transport';

function dispatcherReturning(response: { status: number; body: unknown }): AgentDispatcher & {
  request: jest.Mock;
} {
  return { request: jest.fn().mockResolvedValue(response) };
}

describe('createInProcessTransport', () => {
  it('should dispatch with the bearer token and the configured timeout', async () => {
    const dispatcher = dispatcherReturning({ status: 200, body: { data: [] } });
    const requester = createInProcessTransport({ dispatcher, timeoutMs: 2500 }).createRequester(
      'tok',
    );

    await requester.query({ method: 'post', path: '/forest/users', body: { a: 1 } });

    expect(dispatcher.request).toHaveBeenCalledWith({
      method: 'post',
      path: '/forest/users',
      headers: {
        Authorization: 'Bearer tok',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      query: { timezone: 'Europe/Paris' },
      payload: { a: 1 },
      timeoutMs: 2500,
    });
  });

  it('should refuse to stream with a 501, since there is no socket to stream from', async () => {
    const dispatcher = dispatcherReturning({ status: 200, body: {} });
    const requester = createInProcessTransport({ dispatcher }).createRequester('tok');

    const stream = requester.stream as () => Promise<void>;

    await expect(stream()).rejects.toMatchObject({
      name: 'BffHttpError',
      status: 501,
      type: 'streaming_unsupported',
      message: 'Streaming is not supported over the in-process transport',
    });
  });
});
