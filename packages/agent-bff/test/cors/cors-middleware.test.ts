import type { Logger } from '../../src/ports/logger-port';

import Koa from 'koa';
import request from 'supertest';

import createCorsMiddleware, {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  PREFLIGHT_MAX_AGE_SECONDS,
} from '../../src/cors/cors-middleware';

const ALLOWED = 'https://app.example.com';

function buildApp(logger: Logger = () => undefined) {
  const terminal = jest.fn(async (ctx: Koa.Context) => {
    ctx.status = 200;
    ctx.body = { reached: true };
  });

  const app = new Koa();
  app.use(createCorsMiddleware({ allowedOrigins: [ALLOWED], logger }));
  app.use(terminal);

  return { app, terminal };
}

describe('cors middleware (layer 1)', () => {
  describe('simple request', () => {
    it('echoes the exact allow-listed origin with Vary and no wildcard or credentials', async () => {
      const { app } = buildApp();

      const response = await request(app.callback()).get('/agent/x').set('Origin', ALLOWED);

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
      expect(response.headers['access-control-allow-origin']).not.toBe('*');
      expect(response.headers['access-control-allow-credentials']).toBeUndefined();
      expect(response.headers.vary).toContain('Origin');
    });

    it('matches an allow-listed origin regardless of the default port', async () => {
      const { app } = buildApp();

      const response = await request(app.callback())
        .get('/agent/x')
        .set('Origin', `${ALLOWED}:443`);

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe(`${ALLOWED}:443`);
    });

    it('sends no CORS origin header for a disallowed origin but still proceeds', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback())
        .get('/agent/x')
        .set('Origin', 'https://evil.example.com');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(terminal).toHaveBeenCalled();
    });
  });

  describe('preflight', () => {
    it('answers an allow-listed OPTIONS with 204, methods, the allowed headers and max-age', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback()).options('/agent/x').set('Origin', ALLOWED);

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
      expect(response.headers['access-control-allow-methods']).toBe(ALLOWED_METHODS);
      expect(response.headers['access-control-allow-headers']).toBe(ALLOWED_HEADERS);
      expect(response.headers['access-control-max-age']).toBe(String(PREFLIGHT_MAX_AGE_SECONDS));
      expect(terminal).not.toHaveBeenCalled();
    });

    it('lists all six allowed request headers', () => {
      expect(ALLOWED_HEADERS.split(', ')).toEqual([
        'Authorization',
        'Content-Type',
        'X-Forest-Timezone',
        'X-Forest-Bff-Key',
        'X-Request-Id',
        'Forest-Projection',
      ]);
    });

    it('answers a disallowed OPTIONS with 204 and no CORS headers, short-circuiting before next', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback())
        .options('/agent/x')
        .set('Origin', 'https://evil.example.com');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      expect(response.headers['access-control-allow-methods']).toBeUndefined();
      expect(terminal).not.toHaveBeenCalled();
    });

    it('logs one Warn with the identifiers when the preflight origin is disallowed', async () => {
      const logger = jest.fn();
      const { app } = buildApp(logger);

      const response = await request(app.callback())
        .options('/agent/x')
        .set('Origin', 'https://evil.example.com');

      expect(response.status).toBe(204);
      expect(logger).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith('Warn', 'BFF preflight origin rejected', {
        origin: 'https://evil.example.com',
        path: '/agent/x',
      });
    });

    it('logs nothing when the preflight origin is allow-listed', async () => {
      const logger = jest.fn();

      await request(buildApp(logger).app.callback()).options('/agent/x').set('Origin', ALLOWED);

      expect(logger).not.toHaveBeenCalled();
    });

    it('does not log an OPTIONS that carries no origin, which is not a preflight', async () => {
      const logger = jest.fn();

      await request(buildApp(logger).app.callback()).options('/agent/x');

      expect(logger).not.toHaveBeenCalled();
    });
  });

  describe('rejection telemetry scope', () => {
    it('logs nothing for a disallowed simple request, which layer 2 guards', async () => {
      const logger = jest.fn();

      await request(buildApp(logger).app.callback())
        .get('/agent/x')
        .set('Origin', 'https://evil.example.com');

      expect(logger).not.toHaveBeenCalled();
    });
  });
});
