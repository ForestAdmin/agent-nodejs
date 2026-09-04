import Koa from 'koa';
import request from 'supertest';

import createCorsMiddleware, {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  PREFLIGHT_MAX_AGE_SECONDS,
} from '../../src/cors/cors-middleware';

const ALLOWED = 'https://app.example.com';

function buildApp() {
  const terminal = jest.fn(async (ctx: Koa.Context) => {
    ctx.status = 200;
    ctx.body = { reached: true };
  });

  const app = new Koa();
  app.use(createCorsMiddleware({ allowedOrigins: [ALLOWED] }));
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

    it('refuses a disallowed origin instead of running the request', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback())
        .get('/agent/x')
        .set('Origin', 'https://evil.example.com');

      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({ type: 'origin_not_allowed', status: 403 });
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
      // Le point du refus : sans lui la requête s'exécutait, et seul le navigateur jetait la
      // réponse — donc une liste était lue et une action exécutée pour une origine non autorisée.
      expect(terminal).not.toHaveBeenCalled();
    });

    it('leaves a caller with no Origin alone, which is every server-to-server call', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback()).get('/agent/x');

      expect(response.status).toBe(200);
      expect(terminal).toHaveBeenCalled();
    });
  });

  describe('the application serving this BFF', () => {
    it('serves its own page without it having to allow-list itself', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback())
        .post('/agent/x')
        .set('Host', 'self.example.com')
        .set('Origin', 'https://self.example.com');

      expect(response.status).toBe(200);
      expect(terminal).toHaveBeenCalled();
    });

    it('matches on host, so a proxy terminating TLS does not turn it into a refusal', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback())
        .post('/agent/x')
        .set('Host', 'self.example.com')
        .set('Origin', 'http://self.example.com');

      expect(response.status).toBe(200);
      expect(terminal).toHaveBeenCalled();
    });

    it('serves it when a proxy spells out the default https port in Host', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback())
        .post('/agent/x')
        .set('Host', 'self.example.com:443')
        .set('Origin', 'https://self.example.com');

      expect(response.status).toBe(200);
      expect(terminal).toHaveBeenCalled();
    });

    it('serves it when a proxy spells out the default http port in Host', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback())
        .post('/agent/x')
        .set('Host', 'self.example.com:80')
        .set('Origin', 'http://self.example.com');

      expect(response.status).toBe(200);
      expect(terminal).toHaveBeenCalled();
    });

    it('serves it whatever the case of the Host header, since hostnames are case-insensitive', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback())
        .post('/agent/x')
        .set('Host', 'SELF.EXAMPLE.COM')
        .set('Origin', 'https://self.example.com');

      expect(response.status).toBe(200);
      expect(terminal).toHaveBeenCalled();
    });

    it('still refuses the same hostname on another port, which is another origin', async () => {
      const { app, terminal } = buildApp();

      const response = await request(app.callback())
        .post('/agent/x')
        .set('Host', 'self.example.com')
        .set('Origin', 'https://self.example.com:8443');

      expect(response.status).toBe(403);
      expect(terminal).not.toHaveBeenCalled();
    });

    it('sends no Access-Control-Allow-Origin, which same-origin never needs', async () => {
      const { app } = buildApp();

      const response = await request(app.callback())
        .post('/agent/x')
        .set('Host', 'self.example.com')
        .set('Origin', 'https://self.example.com');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
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
  });
});
