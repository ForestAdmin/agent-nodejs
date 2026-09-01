import type { AgentDispatcher } from '../../src/agent/in-process-transport';

import createInProcessTransport from '../../src/agent/in-process-transport';

function dispatcherReturning(response: {
  status: number;
  body: unknown;
  text?: string;
}): AgentDispatcher & { request: jest.Mock } {
  return { request: jest.fn().mockResolvedValue(response) };
}

describe('createInProcessTransport', () => {
  it('should dispatch the request with the bearer token and the caller query', async () => {
    const dispatcher = dispatcherReturning({ status: 200, body: { data: [] } });
    const requester = createInProcessTransport({ dispatcher }).createRequester('tok');

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
      timeoutMs: undefined,
    });
  });

  describe('when a path segment needs escaping', () => {
    it('should escape it exactly as buildUrl does on the HTTP path', async () => {
      const dispatcher = dispatcherReturning({ status: 200, body: {} });
      const requester = createInProcessTransport({ dispatcher }).createRequester('tok');

      await requester.query({ method: 'get', path: '/forest/orders/A B+c' });

      expect(dispatcher.request).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/forest/orders/A%20B\\+c' }),
      );
    });

    it('should prefix a relative path with a slash, as buildUrl does', async () => {
      const dispatcher = dispatcherReturning({ status: 200, body: {} });
      const requester = createInProcessTransport({ dispatcher }).createRequester('tok');

      await requester.query({ method: 'get', path: 'forest/users' });

      expect(dispatcher.request).toHaveBeenCalledWith(
        expect.objectContaining({ path: '/forest/users' }),
      );
    });
  });

  describe('when the caller sets no timeout', () => {
    it('should fall back to the configured one', async () => {
      const dispatcher = dispatcherReturning({ status: 200, body: {} });
      const requester = createInProcessTransport({ dispatcher, timeoutMs: 2500 }).createRequester(
        'tok',
      );

      await requester.query({ method: 'get', path: '/forest/users' });

      expect(dispatcher.request).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 2500 }));
    });

    it('should let an explicit maxTimeAllowed win', async () => {
      const dispatcher = dispatcherReturning({ status: 200, body: {} });
      const requester = createInProcessTransport({ dispatcher, timeoutMs: 2500 }).createRequester(
        'tok',
      );

      await requester.query({ method: 'get', path: '/forest/users', maxTimeAllowed: 100 });

      expect(dispatcher.request).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 100 }));
    });
  });

  describe('when the agent answers with an error status', () => {
    it('should throw the same AgentHttpError shape as the HTTP path', async () => {
      const dispatcher = dispatcherReturning({
        status: 403,
        body: { errors: [{ detail: 'Forbidden' }] },
      });
      const requester = createInProcessTransport({ dispatcher }).createRequester('tok');

      await expect(requester.query({ method: 'get', path: '/forest/users' })).rejects.toMatchObject(
        { status: 403 },
      );
    });
  });

  it('should refuse to stream, since there is no socket to stream from', async () => {
    const dispatcher = dispatcherReturning({ status: 200, body: {} });
    const requester = createInProcessTransport({ dispatcher }).createRequester('tok');

    const stream = requester.stream as () => Promise<void>;

    await expect(stream()).rejects.toThrow(
      'Streaming is not supported over the in-process transport',
    );
  });
});
