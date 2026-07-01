import Koa from 'koa';
import request from 'supertest';

import createPerKeyOriginMiddleware from '../../src/cors/per-key-origin';
import createErrorMiddleware from '../../src/http/error-middleware';

function buildApp(allowedOrigins: string[]) {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: () => undefined }));
  app.use(async (ctx, next) => {
    ctx.state.apiKeyIdentity = { allowedOrigins };
    await next();
  });
  app.use(createPerKeyOriginMiddleware());
  app.use(async ctx => {
    ctx.status = 200;
    ctx.body = { reached: true };
  });

  return app;
}

describe('per-key origin middleware (layer 2)', () => {
  it('proceeds when the origin is in the per-key list', async () => {
    const response = await request(buildApp(['https://a.com']).callback())
      .get('/agent/x')
      .set('Origin', 'https://a.com');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reached: true });
  });

  it('returns 403 origin_not_allowed when the origin is not in the per-key list', async () => {
    const response = await request(buildApp(['https://a.com']).callback())
      .get('/agent/x')
      .set('Origin', 'https://b.com');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: { type: 'origin_not_allowed', status: 403, message: expect.any(String) },
    });
  });

  it('matches a per-key origin returned by SaaS in a non-normalized form', async () => {
    const response = await request(buildApp(['https://a.com:443']).callback())
      .get('/agent/x')
      .set('Origin', 'https://a.com');

    expect(response.status).toBe(200);
  });

  it('is a no-op when the per-key list is empty', async () => {
    const response = await request(buildApp([]).callback())
      .get('/agent/x')
      .set('Origin', 'https://anything.com');

    expect(response.status).toBe(200);
  });

  it('returns 403 when the per-key list is non-empty and the request has no Origin', async () => {
    const response = await request(buildApp(['https://a.com']).callback()).get('/agent/x');

    expect(response.status).toBe(403);
    expect(response.body.error.type).toBe('origin_not_allowed');
  });
});
