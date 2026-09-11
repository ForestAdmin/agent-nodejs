import type { LoggerLevel } from '../../src/ports/logger-port';

import Koa from 'koa';
import request from 'supertest';

import createAccessLogMiddleware from '../../src/http/access-log-middleware';

type Line = [LoggerLevel, string];

function buildApp(downstream: Koa.Middleware, basePath = '') {
  const lines: Line[] = [];
  const app = new Koa();
  app.silent = true;
  app.use(
    createAccessLogMiddleware({
      logger: (level, message) => lines.push([level, message]),
      basePath,
    }),
  );
  app.use(downstream);

  return { callback: app.callback(), lines };
}

function respond(status: number): Koa.Middleware {
  return async ctx => {
    ctx.status = status;
    ctx.body = {};
  };
}

describe('access log middleware', () => {
  it('logs the status, method, path and duration of a served request', async () => {
    const { callback, lines } = buildApp(respond(200));

    await request(callback).get('/agent/v1/collections/companies');

    expect(lines).toHaveLength(1);
    expect(lines[0][1]).toMatch(/^\[200\] GET \/agent\/v1\/collections\/companies - \d+ms$/);
  });

  it('leaves the query string out of the line', async () => {
    const { callback, lines } = buildApp(respond(200));

    await request(callback).get('/oauth/authorize?state=secret&client_id=abc');

    expect(lines[0][1]).toMatch(/^\[200\] GET \/oauth\/authorize - \d+ms$/);
  });

  it('names the method of a non-GET request', async () => {
    const { callback, lines } = buildApp(respond(201));

    await request(callback).post('/agent/v1/actions/run');

    expect(lines[0][1]).toMatch(/^\[201\] POST \/agent\/v1\/actions\/run - \d+ms$/);
  });

  it('logs a served request at Info', async () => {
    const { callback, lines } = buildApp(respond(204));

    await request(callback).get('/health');

    expect(lines[0][0]).toBe('Info');
  });

  it('logs a client error at Warn', async () => {
    const { callback, lines } = buildApp(respond(401));

    await request(callback).get('/agent/v1/collections/companies');

    expect(lines[0]).toEqual(['Warn', expect.stringMatching(/^\[401\] GET/)]);
  });

  it('logs a server error at Error', async () => {
    const { callback, lines } = buildApp(respond(502));

    await request(callback).get('/agent/v1/collections/companies');

    expect(lines[0]).toEqual(['Error', expect.stringMatching(/^\[502\] GET/)]);
  });

  it('reads the status off a thrown error rather than off the untouched response', async () => {
    const { callback, lines } = buildApp(async () => {
      throw Object.assign(new Error('Payload too large'), { status: 413 });
    });

    await request(callback).get('/oauth/token');

    expect(lines[0]).toEqual([
      'Warn',
      expect.stringMatching(/^\[413\] GET \/oauth\/token - \d+ms$/),
    ]);
  });

  it('reads a status carried as statusCode', async () => {
    const { callback, lines } = buildApp(async () => {
      throw Object.assign(new Error('bad request'), { statusCode: 400 });
    });

    await request(callback).get('/oauth/token');

    expect(lines[0][1]).toMatch(/^\[400\] GET/);
  });

  it('falls back to 500 for an error carrying no status', async () => {
    const { callback, lines } = buildApp(async () => {
      throw new Error('unexpected');
    });

    await request(callback).get('/docs');

    expect(lines[0]).toEqual(['Error', expect.stringMatching(/^\[500\] GET \/docs - \d+ms$/)]);
  });

  it('rethrows so the response status is decided downstream, not by the log', async () => {
    const { callback } = buildApp(async () => {
      throw new Error('unexpected');
    });

    const res = await request(callback).get('/docs');

    expect(res.status).toBe(500);
  });

  it('logs a request once', async () => {
    const { callback, lines } = buildApp(respond(200));

    await request(callback).get('/health');

    expect(lines).toHaveLength(1);
  });

  it('serves the response the route computed when the host logger throws', async () => {
    const app = new Koa();
    app.silent = true;
    app.use(
      createAccessLogMiddleware({
        logger: () => {
          throw new Error('sink is down');
        },
        basePath: '',
      }),
    );
    app.use(respond(200));

    const res = await request(app.callback()).get('/health');

    expect(res.status).toBe(200);
  });

  it('propagates the original exception when the host logger throws on the error path', async () => {
    const app = new Koa();
    app.silent = true;
    let propagated: unknown;
    app.use(async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        propagated = error;
        ctx.status = 500;
      }
    });
    app.use(
      createAccessLogMiddleware({
        logger: () => {
          throw new Error('sink is down');
        },
        basePath: '',
      }),
    );
    app.use(async () => {
      throw new TypeError('the real cause');
    });

    await request(app.callback()).get('/agent/v1/collections/companies');

    expect(propagated).toBeInstanceOf(TypeError);
    expect((propagated as Error).message).toBe('the real cause');
  });

  it('prefixes the path with the base path the host serves the BFF under', async () => {
    const { callback, lines } = buildApp(respond(200), '/bff');

    await request(callback).get('/agent/openapi.json');

    expect(lines[0][1]).toMatch(/^\[200\] GET \/bff\/agent\/openapi\.json - \d+ms$/);
  });

  it('prefers the prefix the host actually stripped over the configured one', async () => {
    const lines: Line[] = [];
    const app = new Koa();
    app.silent = true;
    app.use(async (ctx, next) => {
      (ctx.req as { originalUrl?: string }).originalUrl = `/api/bff${ctx.url}`;
      await next();
    });
    app.use(createAccessLogMiddleware({ logger: (l, m) => lines.push([l, m]), basePath: '/bff' }));
    app.use(respond(200));

    await request(app.callback()).get('/health');

    expect(lines[0][1]).toMatch(/^\[200\] GET \/api\/bff\/health - \d+ms$/);
  });
});
