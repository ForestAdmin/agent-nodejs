import bodyParser from '@koa/bodyparser';
import Router from '@koa/router';
import Koa from 'koa';

import InProcessDispatcher from '../src/mcp-in-process-dispatcher';

function handlerFor(build: (router: Router) => void) {
  const router = new Router();
  build(router);

  return new Koa().use(router.routes()).callback();
}

describe('InProcessDispatcher', () => {
  it('throws when no handler is mounted yet', async () => {
    const dispatcher = new InProcessDispatcher();

    await expect(dispatcher.request({ method: 'get', path: '/ping', headers: {} })).rejects.toThrow(
      /not mounted/,
    );
  });

  it('dispatches to the handler and returns status, body and text', async () => {
    const dispatcher = new InProcessDispatcher();
    dispatcher.setHandler(
      handlerFor(r =>
        r.get('/ping', ctx => {
          ctx.body = { pong: true };
        }),
      ),
    );

    const response = await dispatcher.request({ method: 'get', path: '/ping', headers: {} });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ pong: true });
    expect(JSON.parse(response.text)).toEqual({ pong: true });
  });

  it('forwards headers (e.g. Authorization) to the handler', async () => {
    const dispatcher = new InProcessDispatcher();
    dispatcher.setHandler(
      handlerFor(r =>
        r.get('/whoami', ctx => {
          ctx.body = { auth: ctx.headers.authorization };
        }),
      ),
    );

    const response = await dispatcher.request({
      method: 'get',
      path: '/whoami',
      headers: { Authorization: 'Bearer tok' },
    });

    expect(response.body).toEqual({ auth: 'Bearer tok' });
  });

  it('forwards query params and preserves non-2xx status', async () => {
    const dispatcher = new InProcessDispatcher();
    dispatcher.setHandler(
      handlerFor(r =>
        r.get('/q', ctx => {
          ctx.status = 422;
          ctx.body = { got: ctx.query.foo };
        }),
      ),
    );

    const response = await dispatcher.request({
      method: 'get',
      path: '/q',
      headers: {},
      query: { foo: 'bar' },
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ got: 'bar' });
  });

  it('forwards the payload and content-type to the handler (mutating call)', async () => {
    const dispatcher = new InProcessDispatcher();
    dispatcher.setHandler(
      handlerFor(r =>
        r.post('/echo', async ctx => {
          const raw = await new Promise<string>(resolve => {
            let data = '';
            ctx.req.on('data', chunk => {
              data += chunk;
            });
            ctx.req.on('end', () => resolve(data));
          });

          ctx.body = { received: JSON.parse(raw), contentType: ctx.headers['content-type'] };
        }),
      ),
    );

    const response = await dispatcher.request({
      method: 'post',
      path: '/echo',
      headers: { 'Content-Type': 'application/json' },
      payload: { name: 'Ada' },
    });

    expect(response.body).toEqual({
      received: { name: 'Ada' },
      contentType: 'application/json',
    });
  });

  it('preserves router-level middleware (bodyParser) so a mutating body reaches the route parsed', async () => {
    // Mirrors FrameworkMounter.getInProcessDispatcher(): a `/forest`-prefixed router wrapping a
    // driver router that carries bodyParser via `router.use()` (as agent.ts does). Guards against
    // a regression where the wrapping drops router-level middleware and mutating tool calls
    // (create/update/…) reach the route with an unparsed body.
    const driver = new Router();
    driver.use(bodyParser({ parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'] }));
    driver.post('/users', ctx => {
      ctx.body = { got: ctx.request.body };
    });
    const dispatcher = new InProcessDispatcher();
    dispatcher.setHandler(
      new Koa().use(new Router({ prefix: '/forest' }).use(driver.routes()).routes()).callback(),
    );

    const response = await dispatcher.request({
      method: 'post',
      path: '/forest/users',
      headers: { 'Content-Type': 'application/json' },
      payload: { email: 'in@process.dev' },
    });

    expect(response.body).toEqual({ got: { email: 'in@process.dev' } });
  });

  it('rejects when the handler does not respond within the timeout', async () => {
    const dispatcher = new InProcessDispatcher();
    dispatcher.setHandler(handlerFor(r => r.get('/hang', () => new Promise(() => {}))));

    await expect(
      dispatcher.request({ method: 'get', path: '/hang', headers: {}, timeoutMs: 50 }),
    ).rejects.toThrow(/timed out after 50ms/);
  });

  it('returns an undefined body for an empty (204) response', async () => {
    const dispatcher = new InProcessDispatcher();
    dispatcher.setHandler(
      handlerFor(r =>
        r.delete('/x', ctx => {
          ctx.status = 204;
        }),
      ),
    );

    const response = await dispatcher.request({ method: 'delete', path: '/x', headers: {} });

    expect(response.status).toBe(204);
    expect(response.body).toBeUndefined();
  });

  it('warns and returns an undefined body when a non-empty response body is not JSON', async () => {
    const logger = jest.fn();
    const dispatcher = new InProcessDispatcher(logger);
    dispatcher.setHandler(
      handlerFor(r =>
        r.get('/broken', ctx => {
          ctx.type = 'text/plain';
          ctx.body = 'not json';
        }),
      ),
    );

    const response = await dispatcher.request({ method: 'get', path: '/broken', headers: {} });

    expect(response.body).toBeUndefined();
    expect(response.text).toBe('not json');
    expect(logger).toHaveBeenCalledWith('Warn', expect.stringContaining('non-JSON response body'));
  });

  it('reflects a handler swap (remount) instead of a stale reference', async () => {
    const dispatcher = new InProcessDispatcher();
    dispatcher.setHandler(
      handlerFor(r =>
        r.get('/v', ctx => {
          ctx.body = { v: 1 };
        }),
      ),
    );
    expect((await dispatcher.request({ method: 'get', path: '/v', headers: {} })).body).toEqual({
      v: 1,
    });

    dispatcher.setHandler(
      handlerFor(r =>
        r.get('/v', ctx => {
          ctx.body = { v: 2 };
        }),
      ),
    );
    expect((await dispatcher.request({ method: 'get', path: '/v', headers: {} })).body).toEqual({
      v: 2,
    });
  });
});
