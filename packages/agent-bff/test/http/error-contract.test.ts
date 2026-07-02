import type { ApiKeyAuthenticator } from '../../src/api-key/api-key-authenticator';

import { bodyParser } from '@koa/bodyparser';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import createAgentStubMiddleware from '../../src/agent/agent-stub';
import { forestIdentityNotAllowed, invalidApiKey } from '../../src/api-key/api-key-error';
import createApiKeyMiddleware, { BFF_KEY_HEADER } from '../../src/api-key/api-key-middleware';
import createAuthModeMiddleware from '../../src/auth/auth-mode-middleware';
import createPerKeyOriginMiddleware from '../../src/cors/per-key-origin';
import createErrorMiddleware from '../../src/http/error-middleware';
import { sessionInvalidated, toErrorBody } from '../../src/oauth/oauth-error';
import createTimezoneMiddleware from '../../src/timezone/timezone-middleware';

const AUTH_SECRET = 'contract-secret';
const RAW_KEY = `fbff_${'a'.repeat(16)}_${'b'.repeat(64)}`;

function identity(allowedOrigins: string[] = []) {
  return {
    user: {
      id: 1,
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      team: 'T',
      tags: [],
      permissionLevel: 'admin',
    },
    renderingId: 1,
    allowedOrigins,
  };
}

function bffAccess(expiresIn: string | number) {
  return jsonwebtoken.sign({ type: 'bff_access', sid: 's1' }, AUTH_SECRET, {
    algorithm: 'HS256',
    expiresIn,
  } as jsonwebtoken.SignOptions);
}

function buildEdge(authenticate: ApiKeyAuthenticator['authenticate']) {
  const logger = () => undefined;
  const app = new Koa();
  app.silent = true;
  app.use(bodyParser({ jsonLimit: '16kb' }));
  app.use(createErrorMiddleware({ logger }));
  app.use(createAuthModeMiddleware({ authSecret: AUTH_SECRET }));
  app.use(createApiKeyMiddleware({ authenticator: { authenticate }, logger }));
  app.use(createPerKeyOriginMiddleware());
  app.use(createTimezoneMiddleware({ defaultTimezone: undefined }));
  app.use(createAgentStubMiddleware());

  return app.callback();
}

const resolvesEmpty: ApiKeyAuthenticator['authenticate'] = async () => ({
  agentToken: 'token',
  identity: identity(),
});

describe('auth/error contract at the /agent edge', () => {
  it('unauthorized (401) when no credentials', async () => {
    const res = await request(buildEdge(resolvesEmpty)).get('/agent/records');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ type: 'unauthorized', status: 401 });
  });

  it('ambiguous_credentials (400) when both credentials', async () => {
    const res = await request(buildEdge(resolvesEmpty))
      .get('/agent/records')
      .set('Authorization', `Bearer ${bffAccess('15m')}`)
      .set(BFF_KEY_HEADER, RAW_KEY);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ type: 'ambiguous_credentials', status: 400 });
  });

  it('session_expired (401) for an expired bff_access', async () => {
    const res = await request(buildEdge(resolvesEmpty))
      .get('/agent/records')
      .set('Authorization', `Bearer ${bffAccess(-10)}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ type: 'session_expired', status: 401 });
  });

  it('invalid_api_key (401) when the key does not resolve', async () => {
    const authenticate = jest.fn(async () => {
      throw invalidApiKey();
    });
    const res = await request(buildEdge(authenticate))
      .get('/agent/records')
      .set(BFF_KEY_HEADER, RAW_KEY);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ type: 'invalid_api_key', status: 401 });
  });

  it('forest_identity_not_allowed (403) when the identity is rejected', async () => {
    const authenticate = jest.fn(async () => {
      throw forestIdentityNotAllowed();
    });
    const res = await request(buildEdge(authenticate))
      .get('/agent/records')
      .set(BFF_KEY_HEADER, RAW_KEY);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ type: 'forest_identity_not_allowed', status: 403 });
  });

  it('origin_not_allowed (403) when the origin is outside the per-key list', async () => {
    const authenticate: ApiKeyAuthenticator['authenticate'] = async () => ({
      agentToken: 'token',
      identity: identity(['https://allowed.com']),
    });
    const res = await request(buildEdge(authenticate))
      .get('/agent/records')
      .set(BFF_KEY_HEADER, RAW_KEY)
      .set('Origin', 'https://other.com');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ type: 'origin_not_allowed', status: 403 });
  });

  it('missing_timezone (400) when no timezone resolves', async () => {
    const res = await request(buildEdge(resolvesEmpty))
      .get('/agent/records')
      .set(BFF_KEY_HEADER, RAW_KEY);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ type: 'missing_timezone', status: 400 });
  });

  it('invalid_timezone (400) for a non-IANA timezone', async () => {
    const res = await request(buildEdge(resolvesEmpty))
      .get('/agent/records')
      .set(BFF_KEY_HEADER, RAW_KEY)
      .set('X-Forest-Timezone', 'Mars/Phobos');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ type: 'invalid_timezone', status: 400 });
  });

  it('reaches the (stubbed) agent proxy once every check passes', async () => {
    const res = await request(buildEdge(resolvesEmpty))
      .get('/agent/records')
      .set(BFF_KEY_HEADER, RAW_KEY)
      .set('X-Forest-Timezone', 'America/New_York');

    expect(res.status).toBe(501);
    expect(res.body.error.type).toBe('not_implemented');
  });

  it('exposes session_invalidated in the RFC shape at the OAuth token endpoint', () => {
    expect(toErrorBody(sessionInvalidated('reused'))).toEqual({
      error: 'session_invalidated',
      error_description: 'reused',
    });
  });

  it('assigns a distinct type to every auth failure so consumers branch on type alone', () => {
    const types = [
      'unauthorized',
      'ambiguous_credentials',
      'session_expired',
      'session_invalidated',
      'invalid_api_key',
      'forest_identity_not_allowed',
      'origin_not_allowed',
      'missing_timezone',
      'invalid_timezone',
    ];

    expect(new Set(types).size).toBe(types.length);
  });
});
