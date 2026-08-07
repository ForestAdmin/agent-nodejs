import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import createAuthModeMiddleware, { BFF_KEY_HEADER } from '../../src/auth/auth-mode-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';

const AUTH_SECRET = 'test-secret';
const RAW_KEY = `fbff_${'a'.repeat(16)}_${'b'.repeat(64)}`;

const PRINCIPAL = {
  sid: 's1',
  id: 7,
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  team: 'Ops',
  rendering_id: '42',
  permission_level: 'admin',
  role: 'Support agent',
  tags: { seat: 'a1' },
};

function bffAccess(expiresIn: string | number, type = 'bff_access') {
  return jsonwebtoken.sign({ ...PRINCIPAL, type }, AUTH_SECRET, {
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
    ctx.body = {
      authMode: ctx.state.authMode,
      agentToken: ctx.state.agentToken ?? null,
      cacheControl: ctx.response.get('Cache-Control') || null,
    };
  });

  return app.callback();
}

function decodeAgentToken(token: string) {
  return jsonwebtoken.verify(token, AUTH_SECRET, { algorithms: ['HS256'] }) as Record<
    string,
    unknown
  >;
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

  it('mints an agent token from the principal so agent routes work in oauth mode', async () => {
    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${bffAccess('15m')}`);

    expect(response.status).toBe(200);
    expect(typeof response.body.agentToken).toBe('string');
    expect(decodeAgentToken(response.body.agentToken)).toMatchObject({
      id: 7,
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      team: 'Ops',
      permissionLevel: 'admin',
      role: 'Support agent',
      tags: { seat: 'a1' },
      first_name: 'Jane',
      last_name: 'Doe',
      permission_level: 'admin',
    });
  });

  it('rejects a minted agent token presented back as a session bearer', async () => {
    const minted = (
      await request(buildApp())
        .get('/agent/x')
        .set('Authorization', `Bearer ${bffAccess('15m')}`)
    ).body.agentToken;

    const replay = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${minted}`);

    expect(replay.status).toBe(401);
    expect(replay.body.error.type).toBe('unauthorized');
  });

  it('expires the agent token after AGENT_TOKEN_EXPIRES_IN', async () => {
    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${bffAccess('15m')}`);

    const claims = decodeAgentToken(response.body.agentToken);

    expect((claims.exp as number) - (claims.iat as number)).toBe(5 * 60);
  });

  it('sends rendering_id to the agent as a number, matching Caller.renderingId', async () => {
    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${bffAccess('15m')}`);

    const claims = decodeAgentToken(response.body.agentToken);

    expect(claims.renderingId).toBe(42);
    expect(claims.rendering_id).toBe(42);
  });

  it('marks an oauth response no-store, mirroring the api-key branch', async () => {
    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${bffAccess('15m')}`);

    expect(response.body.cacheControl).toBe('no-store');
  });

  it('does not mint an agent token on the api-key branch', async () => {
    const response = await request(buildApp()).get('/agent/x').set(BFF_KEY_HEADER, RAW_KEY);

    expect(response.body.agentToken).toBeNull();
  });

  it('accepts a lowercase bearer scheme (auth schemes are case-insensitive)', async () => {
    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `bearer ${bffAccess('15m')}`);

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

  it('returns 401 unauthorized for an expired token of the wrong type (type checked before expiry)', async () => {
    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${bffAccess(-10, 'agent_token')}`);

    expect(response.status).toBe(401);
    expect(response.body.error.type).toBe('unauthorized');
  });

  it('returns 401 unauthorized for a bff_access token with no exp claim', async () => {
    const noExp = jsonwebtoken.sign({ type: 'bff_access', sid: 's1' }, AUTH_SECRET, {
      algorithm: 'HS256',
    });

    const response = await request(buildApp())
      .get('/agent/x')
      .set('Authorization', `Bearer ${noExp}`);

    expect(response.status).toBe(401);
    expect(response.body.error.type).toBe('unauthorized');
  });
});
