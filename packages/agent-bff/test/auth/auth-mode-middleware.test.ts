import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import createAuthModeMiddleware, { BFF_KEY_HEADER } from '../../src/auth/auth-mode-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';

const AUTH_SECRET = 'test-secret';
const RAW_KEY = `fbff_${'a'.repeat(16)}_${'b'.repeat(64)}`;

function bffAccess(expiresIn: string | number, type = 'bff_access') {
  return jsonwebtoken.sign({ type, sid: 's1' }, AUTH_SECRET, {
    algorithm: 'HS256',
    expiresIn,
  } as jsonwebtoken.SignOptions);
}

function buildApp() {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: () => undefined }));
  app.use(createAuthModeMiddleware({ authSecret: AUTH_SECRET }));
  app.use(async ctx => {
    ctx.status = 200;
    ctx.body = { authMode: ctx.state.authMode };
  });

  return app.callback();
}

describe('auth mode middleware', () => {
  it('returns 400 ambiguous_credentials when both Bearer and API key are present', async () => {
    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${bffAccess('15m')}`)
      .set(BFF_KEY_HEADER, RAW_KEY);

    expect(response.status).toBe(400);
    expect(response.body.error.type).toBe('ambiguous_credentials');
  });

  it('returns 401 unauthorized when neither credential is present', async () => {
    const response = await request(buildApp()).get('/agent/x');

    expect(response.status).toBe(401);
    expect(response.body.error.type).toBe('unauthorized');
  });

  it('resolves api-key when only the API key header is present', async () => {
    const response = await request(buildApp()).get('/agent/x').set(BFF_KEY_HEADER, RAW_KEY);

    expect(response.status).toBe(200);
    expect(response.body.authMode).toBe('api-key');
  });

  it('resolves oauth for a valid bff_access Bearer', async () => {
    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${bffAccess('15m')}`);

    expect(response.status).toBe(200);
    expect(response.body.authMode).toBe('oauth');
  });

  it('returns 401 session_expired for an expired bff_access', async () => {
    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${bffAccess(-10)}`);

    expect(response.status).toBe(401);
    expect(response.body.error.type).toBe('session_expired');
  });

  it('returns 401 unauthorized for a bad signature', async () => {
    const forged = jsonwebtoken.sign({ type: 'bff_access' }, 'wrong-secret', {
      algorithm: 'HS256',
    });

    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${forged}`);

    expect(response.status).toBe(401);
    expect(response.body.error.type).toBe('unauthorized');
  });

  it('returns 401 unauthorized when the token type is not bff_access', async () => {
    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${bffAccess('15m', 'agent_token')}`);

    expect(response.status).toBe(401);
    expect(response.body.error.type).toBe('unauthorized');
  });
});
