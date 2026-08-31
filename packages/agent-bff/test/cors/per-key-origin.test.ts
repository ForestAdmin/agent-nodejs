import type { Logger } from '../../src/ports/logger-port';

import Koa from 'koa';
import request from 'supertest';

import createPerKeyOriginMiddleware from '../../src/cors/per-key-origin';
import createErrorMiddleware from '../../src/http/error-middleware';

const RENDERING_ID = 42;

function buildApp(allowedOrigins?: string[], logger: Logger = () => undefined) {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: () => undefined }));
  app.use(async (ctx, next) => {
    if (allowedOrigins !== undefined) {
      ctx.state.apiKeyIdentity = { allowedOrigins, renderingId: RENDERING_ID };
    }

    await next();
  });
  app.use(createPerKeyOriginMiddleware({ logger }));
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

  it('does not restrict an oauth request, which carries no per-key identity', async () => {
    const response = await request(buildApp().callback())
      .get('/agent/x')
      .set('Origin', 'https://anything.com');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reached: true });
  });

  describe('rejection telemetry', () => {
    it('logs one Warn with the identifiers when the origin is rejected', async () => {
      const logger = jest.fn();

      const response = await request(buildApp(['https://a.com'], logger).callback())
        .get('/agent/x')
        .set('Origin', 'https://b.com');

      expect(response.status).toBe(403);
      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith('Warn', 'BFF per-key origin rejected', {
        origin: 'https://b.com',
        path: '/agent/x',
        renderingId: RENDERING_ID,
      });
    });

    it('logs the absent origin as an empty string when a restricted key sends none', async () => {
      const logger = jest.fn();

      const response = await request(buildApp(['https://a.com'], logger).callback()).get(
        '/agent/x',
      );

      expect(response.status).toBe(403);
      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith('Warn', 'BFF per-key origin rejected', {
        origin: '',
        path: '/agent/x',
        renderingId: RENDERING_ID,
      });
    });

    it('logs nothing when the origin is allowed', async () => {
      const logger = jest.fn();

      await request(buildApp(['https://a.com'], logger).callback())
        .get('/agent/x')
        .set('Origin', 'https://a.com');

      expect(logger).not.toHaveBeenCalled();
    });

    it('logs nothing when the request carries no per-key identity', async () => {
      const logger = jest.fn();

      await request(buildApp(undefined, logger).callback())
        .get('/agent/x')
        .set('Origin', 'https://anything.com');

      expect(logger).not.toHaveBeenCalled();
    });
  });
});
