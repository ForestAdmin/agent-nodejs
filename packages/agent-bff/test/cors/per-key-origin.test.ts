import type { Logger } from '../../src/ports/logger-port';

import Koa from 'koa';
import request from 'supertest';

import { fingerprintApiKey } from '../../src/api-key/api-key';
import { BFF_KEY_HEADER } from '../../src/api-key/api-key-middleware';
import createPerKeyOriginMiddleware from '../../src/cors/per-key-origin';
import createErrorMiddleware from '../../src/http/error-middleware';

const RENDERING_ID = 42;
const RAW_KEY = 'forest-bff-key-under-test';

function buildApp(
  allowedOrigins?: string[],
  logger: Logger = () => undefined,
  serverAllowedOrigins?: string[],
) {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: () => undefined }));
  app.use(async (ctx, next) => {
    if (allowedOrigins !== undefined) {
      ctx.state.apiKeyIdentity = { allowedOrigins, renderingId: RENDERING_ID };
    }

    await next();
  });
  app.use(createPerKeyOriginMiddleware({ logger, serverAllowedOrigins }));
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
        .set('Origin', 'https://b.com')
        .set(BFF_KEY_HEADER, RAW_KEY);

      expect(response.status).toBe(403);
      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith('Warn', 'BFF per-key origin rejected', {
        origin: 'https://b.com',
        path: '/agent/x',
        keyHash: fingerprintApiKey(RAW_KEY),
        renderingId: RENDERING_ID,
      });
    });

    it('logs the absent origin as an empty string when a restricted key sends none', async () => {
      const logger = jest.fn();

      const response = await request(buildApp(['https://a.com'], logger).callback())
        .get('/agent/x')
        .set(BFF_KEY_HEADER, RAW_KEY);

      expect(response.status).toBe(403);
      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith('Warn', 'BFF per-key origin rejected', {
        origin: '',
        path: '/agent/x',
        keyHash: fingerprintApiKey(RAW_KEY),
        renderingId: RENDERING_ID,
      });
    });

    it('truncates an oversized origin, which a caller controls and nothing rate-limits', async () => {
      const logger = jest.fn();
      const origin = `https://${'a'.repeat(4000)}.com`;

      await request(buildApp(['https://a.com'], logger).callback())
        .get('/agent/x')
        .set('Origin', origin)
        .set(BFF_KEY_HEADER, RAW_KEY);

      const [, , context] = logger.mock.calls[0] as [string, string, { origin: string }];

      expect(context.origin).toHaveLength(257);
      expect(context.origin.endsWith('…')).toBe(true);
      expect(origin.startsWith(context.origin.slice(0, -1))).toBe(true);
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

  describe('when no key origin can pass the server allow-list', () => {
    it('reports the key once, naming its origins, instead of leaving no trace at all', async () => {
      const logger = jest.fn();
      const app = buildApp(['https://a.com'], logger, ['https://b.com']);

      await request(app.callback())
        .get('/agent/x')
        .set('Origin', 'https://a.com')
        .set(BFF_KEY_HEADER, RAW_KEY);
      await request(app.callback())
        .get('/agent/x')
        .set('Origin', 'https://a.com')
        .set(BFF_KEY_HEADER, RAW_KEY);

      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'BFF key origins are all outside BFF_ALLOWED_ORIGINS',
        { keyHash: fingerprintApiKey(RAW_KEY), keyOrigins: ['https://a.com'] },
      );
    });

    it('stays silent when one key origin is on the server allow-list', async () => {
      const logger = jest.fn();

      await request(
        buildApp(['https://a.com', 'https://c.com'], logger, ['https://c.com']).callback(),
      )
        .get('/agent/x')
        .set('Origin', 'https://c.com')
        .set(BFF_KEY_HEADER, RAW_KEY);

      expect(logger).not.toHaveBeenCalled();
    });

    it('stays silent when the server allow-list is empty, where no key is at fault', async () => {
      const logger = jest.fn();

      await request(buildApp(['https://a.com'], logger, []).callback())
        .get('/agent/x')
        .set('Origin', 'https://a.com')
        .set(BFF_KEY_HEADER, RAW_KEY);

      expect(logger).not.toHaveBeenCalled();
    });
  });
});
