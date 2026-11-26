import type { AgentDispatcher } from '../src/in-process-http-requester';

import nock from 'nock';

import AgentHttpError, {
  AgentTimeoutError,
  InProcessStreamingUnsupportedError,
} from '../src/errors';
import HttpRequester from '../src/http-requester';
import InProcessHttpRequester, {
  AGENT_DISPATCH_TIMEOUT_CODE,
} from '../src/in-process-http-requester';

const AGENT_URL = 'http://in-process.agent';

function dispatcherReturning(response: {
  status: number;
  body: unknown;
  text?: string;
}): AgentDispatcher & { request: jest.Mock } {
  return { request: jest.fn().mockResolvedValue(response) };
}

/** What superagent actually puts on the wire for `path`, so parity is measured, not asserted. */
async function httpTarget(path: string): Promise<{ path: string; query: URLSearchParams }> {
  let sent = '';
  nock(AGENT_URL)
    .get(/.*/)
    .reply(function reply() {
      sent = this.req.path;

      return [200, {}];
    });

  await new HttpRequester('tok', { url: AGENT_URL }).query({ method: 'get', path });

  const [pathname, search] = sent.split('?');

  return { path: pathname, query: new URLSearchParams(search) };
}

function entriesOf(query: URLSearchParams): [string, string][] {
  return [...query.entries()].sort();
}

describe('InProcessHttpRequester', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it('should dispatch the request with the bearer token and the caller query', async () => {
    const dispatcher = dispatcherReturning({ status: 200, body: { data: [] } });
    const requester = new InProcessHttpRequester('tok', dispatcher);

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

  describe('when a path segment carries a character the HTTP path rewrites', () => {
    it.each([
      ['a space', '/forest/orders/A B'],
      ['a plus, which escapeUrlSlug turns into a path separator', '/forest/orders/A+c'],
      ['a star', '/forest/orders/a*b'],
      ['a question mark, which splits a query off', '/forest/orders/q?x'],
      ['a traversal the URL parser resolves', '/forest/users/../admin'],
    ])('should reach the same agent path as the HTTP transport for %s', async (_label, path) => {
      const dispatcher = dispatcherReturning({ status: 200, body: {} });
      const requester = new InProcessHttpRequester('tok', dispatcher);
      const overHttp = await httpTarget(path);

      await requester.query({ method: 'get', path });

      const dispatched = dispatcher.request.mock.calls[0][0];
      expect(dispatched.path).toBe(overHttp.path);
      expect(entriesOf(new URLSearchParams(dispatched.query))).toEqual(entriesOf(overHttp.query));
    });
  });

  it('should prefix a relative path with a slash, as buildUrl does', async () => {
    const dispatcher = dispatcherReturning({ status: 200, body: {} });
    const requester = new InProcessHttpRequester('tok', dispatcher);

    await requester.query({ method: 'get', path: 'forest/users' });

    expect(dispatcher.request).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/forest/users' }),
    );
  });

  describe('when the caller sets no timeout', () => {
    it('should fall back to the configured one', async () => {
      const dispatcher = dispatcherReturning({ status: 200, body: {} });
      const requester = new InProcessHttpRequester('tok', dispatcher, { defaultTimeoutMs: 2500 });

      await requester.query({ method: 'get', path: '/forest/users' });

      expect(dispatcher.request).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 2500 }));
    });

    it('should let an explicit maxTimeAllowed win', async () => {
      const dispatcher = dispatcherReturning({ status: 200, body: {} });
      const requester = new InProcessHttpRequester('tok', dispatcher, { defaultTimeoutMs: 2500 });

      await requester.query({ method: 'get', path: '/forest/users', maxTimeAllowed: 100 });

      expect(dispatcher.request).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 100 }));
    });
  });

  describe('when the agent answers with an error status', () => {
    it('should throw the same AgentHttpError shape as the HTTP path', async () => {
      const body = { errors: [{ name: 'ForbiddenError', detail: 'Forbidden' }] };
      const text = JSON.stringify(body);
      const dispatcher = dispatcherReturning({ status: 403, body, text });
      const requester = new InProcessHttpRequester('tok', dispatcher);
      nock(AGENT_URL).get(/.*/).reply(403, body);

      const overHttp = (await new HttpRequester('tok', { url: AGENT_URL })
        .query({ method: 'get', path: '/forest/users' })
        .catch(error => error)) as AgentHttpError;
      const overDispatch = await requester
        .query({ method: 'get', path: '/forest/users' })
        .catch(error => error);

      expect(overDispatch).toBeInstanceOf(AgentHttpError);
      expect(overDispatch).toMatchObject({
        name: 'AgentHttpError',
        message: overHttp.message,
        status: 403,
        body,
        responseText: text,
      });
    });
  });

  describe('when the dispatch itself fails', () => {
    it('should carry the cause under a 500, not a transport failure', async () => {
      const dispatcher = { request: jest.fn().mockRejectedValue(new Error('agent hook exploded')) };
      const requester = new InProcessHttpRequester('tok', dispatcher);

      const error = (await requester
        .query({ method: 'get', path: '/forest/users' })
        .catch(caught => caught)) as AgentHttpError;

      expect(error).toBeInstanceOf(AgentHttpError);
      expect(error.status).toBe(500);
      expect((error.body as { errors: { detail: string }[] }).errors[0].detail).toContain(
        'agent hook exploded',
      );
    });
  });

  describe('when the dispatcher times out', () => {
    it('should throw the AgentTimeoutError the HTTP path throws on a timeout', async () => {
      const timeout = Object.assign(new Error('In-process dispatch timed out after 50ms'), {
        code: AGENT_DISPATCH_TIMEOUT_CODE,
      });
      const dispatcher = { request: jest.fn().mockRejectedValue(timeout) };
      const requester = new InProcessHttpRequester('tok', dispatcher);

      const error = (await requester
        .query({ method: 'post', path: '/forest/_actions/users/0/slow' })
        .catch(caught => caught)) as AgentTimeoutError;

      expect(error).toBeInstanceOf(AgentTimeoutError);
      expect(error.message).toBe('In-process dispatch timed out after 50ms');
      expect(error.code).toBe('ECONNABORTED');
    });

    it('should not take an untagged rejection for a timeout', async () => {
      const dispatcher = {
        request: jest.fn().mockRejectedValue(new Error('In-process dispatch timed out after 50ms')),
      };
      const requester = new InProcessHttpRequester('tok', dispatcher);

      const error = (await requester
        .query({ method: 'get', path: '/forest/users' })
        .catch(caught => caught)) as AgentHttpError;

      expect(error).toBeInstanceOf(AgentHttpError);
      expect(error.status).toBe(500);
    });
  });

  it('should send the timezone it was built with', async () => {
    const dispatcher = dispatcherReturning({ status: 200, body: {} });
    const requester = new InProcessHttpRequester('tok', dispatcher, { timezone: 'Asia/Tokyo' });

    await requester.query({ method: 'get', path: '/forest/users' });

    expect(dispatcher.request).toHaveBeenCalledWith(
      expect.objectContaining({ query: { timezone: 'Asia/Tokyo' } }),
    );
  });

  it('should refuse to stream, since there is no socket to stream from', async () => {
    const requester = new InProcessHttpRequester(
      'tok',
      dispatcherReturning({ status: 200, body: {} }),
    );

    await expect(requester.stream()).rejects.toBeInstanceOf(InProcessStreamingUnsupportedError);
  });
});
