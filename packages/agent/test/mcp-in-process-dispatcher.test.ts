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
