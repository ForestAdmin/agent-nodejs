import type ForestServerClient from '../../src/oauth/forest-server-client';
import type { ServerTokens } from '../../src/oauth/forest-server-client';
import type { LoggerLevel } from '../../src/ports/logger-port';
import type { UserInfo } from '@forestadmin/forestadmin-client';

import { ForbiddenError } from '@forestadmin/forestadmin-client';
import { bodyParser } from '@koa/bodyparser';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import { OAuthExchangeError } from '../../src/oauth/forest-server-client';
import createOAuthRoutes from '../../src/oauth/oauth-routes';
import createInMemorySessionStore from '../../src/oauth/session-store';
import createTokenCipher from '../../src/oauth/token-cipher';

const AUTH_SECRET = 'auth-secret';
const APP_URL = 'https://app.forestadmin.com';
const CLIENT_ID = 'client-123';
const REDIRECT_URI = 'http://localhost:4567/callback';
const SENTINEL_ACCESS = 'SAAS-ACCESS-SENTINEL';
const SENTINEL_REFRESH = 'SAAS-REFRESH-SENTINEL';
const KEY = Buffer.alloc(32, 5).toString('base64');

const USER: UserInfo = {
  id: 42,
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  team: 'Support',
  renderingId: 17,
  role: 'Admin',
  tags: {},
  permissionLevel: 'admin',
};

function serverTokens(expFromNow = 3600): ServerTokens {
  return {
    saasAccessToken: SENTINEL_ACCESS,
    saasRefreshToken: SENTINEL_REFRESH,
    renderingId: 17,
    expiresAt: Math.floor(Date.now() / 1000) + expFromNow,
  };
}

interface StubOverrides {
  getRegisteredClient?: ForestServerClient['getRegisteredClient'];
  exchangeCode?: ForestServerClient['exchangeCode'];
  getUserInfo?: ForestServerClient['getUserInfo'];
}

function stubServerClient(overrides: StubOverrides = {}): ForestServerClient {
  return {
    getRegisteredClient:
      overrides.getRegisteredClient ??
      (async () => ({ client_id: CLIENT_ID, redirect_uris: [REDIRECT_URI] })),
    exchangeCode: overrides.exchangeCode ?? (async () => serverTokens()),
    getUserInfo: overrides.getUserInfo ?? (async () => USER),
  } as unknown as ForestServerClient;
}

interface LogLine {
  level: LoggerLevel;
  message: string;
  context?: Record<string, unknown>;
}

function buildApp(serverClient: ForestServerClient) {
  const logs: LogLine[] = [];

  const logger = (level: LoggerLevel, message: string, context?: Record<string, unknown>) => {
    logs.push({ level, message, context });
  };

  const sessionStore = createInMemorySessionStore({
    cipher: createTokenCipher(KEY),
    now: () => Date.now(),
    sessionTtlSeconds: 3600,
  });

  const app = new Koa();
  app.use(bodyParser());
  app.use(
    createOAuthRoutes({
      serverClient,
      sessionStore,
      forestAppUrl: APP_URL,
      authSecret: AUTH_SECRET,
      environmentId: 99,
      logger,
    }),
  );

  return { app, logs, sessionStore };
}

const TOKEN_BODY = {
  grant_type: 'authorization_code',
  code: 'auth-code-1',
  client_id: CLIENT_ID,
  code_verifier: 'a'.repeat(64),
  redirect_uri: REDIRECT_URI,
};

const AUTHORIZE_QUERY = {
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  code_challenge: 'challenge-abc',
  code_challenge_method: 'S256',
  state: 'state-xyz',
};

describe('oauth-routes GET /oauth/authorize', () => {
  describe('when all required params are valid and the client is registered', () => {
    it('should 302-redirect to the Forest server authorize url with the forwarded challenge', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback()).get('/oauth/authorize').query(AUTHORIZE_QUERY);

      expect(response.status).toBe(302);
      const location = new URL(response.headers.location);
      expect(location.origin + location.pathname).toBe(`${APP_URL}/oauth/authorize`);
      expect(location.searchParams.get('code_challenge')).toBe('challenge-abc');
      expect(location.searchParams.get('environmentId')).toBe('99');
      expect(location.searchParams.get('state')).toBe('state-xyz');
    });
  });

  describe('when a required param is missing', () => {
    it('should reject with nested invalid_request and not redirect', async () => {
      const { app } = buildApp(stubServerClient());
      const incomplete = { ...AUTHORIZE_QUERY };
      delete (incomplete as Partial<typeof AUTHORIZE_QUERY>).code_challenge;

      const response = await request(app.callback()).get('/oauth/authorize').query(incomplete);

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('invalid_request');
    });
  });

  describe('when the client_id is not registered', () => {
    it('should reject with invalid_client', async () => {
      const { app } = buildApp(stubServerClient({ getRegisteredClient: async () => undefined }));

      const response = await request(app.callback()).get('/oauth/authorize').query(AUTHORIZE_QUERY);

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('invalid_client');
    });
  });

  describe('when code_challenge_method is not S256', () => {
    it('should reject the PKCE downgrade with invalid_request', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, code_challenge_method: 'plain' });

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('invalid_request');
    });

    it('should reject a missing code_challenge_method (S256 is mandatory, not defaulted)', async () => {
      const { app } = buildApp(stubServerClient());
      const query = { ...AUTHORIZE_QUERY };
      delete (query as Partial<typeof AUTHORIZE_QUERY>).code_challenge_method;

      const response = await request(app.callback()).get('/oauth/authorize').query(query);

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('invalid_request');
    });
  });

  describe('when the registered client has no redirect_uris', () => {
    it('should fail closed with invalid_request instead of accepting any redirect_uri', async () => {
      const { app } = buildApp(
        stubServerClient({ getRegisteredClient: async () => ({ client_id: CLIENT_ID }) }),
      );

      const response = await request(app.callback()).get('/oauth/authorize').query(AUTHORIZE_QUERY);

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('invalid_request');
    });
  });

  describe('when the redirect_uri does not match the registered client', () => {
    it('should reject with a structured invalid_request and not redirect', async () => {
      const { app } = buildApp(
        stubServerClient({
          getRegisteredClient: async () => ({
            client_id: CLIENT_ID,
            redirect_uris: ['http://localhost:9999/other'],
          }),
        }),
      );

      const response = await request(app.callback()).get('/oauth/authorize').query(AUTHORIZE_QUERY);

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('invalid_request');
      expect(response.headers.location).toBeUndefined();
    });
  });
});

describe('oauth-routes POST /oauth/token', () => {
  describe('when the authorization_code exchange succeeds', () => {
    it('should return a complete pair (access JWT + opaque refresh) with no SaaS token leaked', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(200);
      expect(response.body.token_type).toBe('Bearer');
      expect(typeof response.body.refresh_token).toBe('string');
      expect(response.body.refresh_token.length).toBeGreaterThanOrEqual(32);

      const decoded = jsonwebtoken.verify(response.body.access_token, AUTH_SECRET) as Record<
        string,
        unknown
      >;
      expect(decoded.type).toBe('bff_access');

      const serialized = JSON.stringify(response.body) + JSON.stringify(decoded);
      expect(serialized).not.toContain(SENTINEL_ACCESS);
      expect(serialized).not.toContain(SENTINEL_REFRESH);
    });

    it('should not leak any SaaS token value into the logs', async () => {
      const { app, logs } = buildApp(stubServerClient());

      await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(JSON.stringify(logs)).not.toContain(SENTINEL_ACCESS);
      expect(JSON.stringify(logs)).not.toContain(SENTINEL_REFRESH);
    });
  });

  describe('when the redirect_uri does not match the registered client', () => {
    it('should reject with invalid_grant (per the error contract) and not exchange', async () => {
      const exchangeCode = jest.fn(async () => serverTokens());
      const { app } = buildApp(
        stubServerClient({
          exchangeCode,
          getRegisteredClient: async () => ({
            client_id: CLIENT_ID,
            redirect_uris: ['http://localhost:9999/other'],
          }),
        }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('invalid_grant');
      expect(exchangeCode).not.toHaveBeenCalled();
    });
  });

  describe('when local validation fails', () => {
    it('should reject a missing field with nested invalid_request and call no SaaS', async () => {
      const exchangeCode = jest.fn(async () => serverTokens());
      const { app } = buildApp(stubServerClient({ exchangeCode }));
      const incomplete = { ...TOKEN_BODY };
      delete (incomplete as Partial<typeof TOKEN_BODY>).code_verifier;

      const response = await request(app.callback()).post('/oauth/token').send(incomplete);

      expect(response.status).toBe(400);
      expect(response.body.error).toEqual({
        type: 'invalid_request',
        status: 400,
        message: expect.any(String),
      });
      expect(exchangeCode).not.toHaveBeenCalled();
    });

    it('should reject an unknown client with invalid_client and call no SaaS exchange', async () => {
      const exchangeCode = jest.fn(async () => serverTokens());
      const { app } = buildApp(
        stubServerClient({ exchangeCode, getRegisteredClient: async () => undefined }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('invalid_client');
      expect(exchangeCode).not.toHaveBeenCalled();
    });
  });

  describe('when the same code is replayed', () => {
    it('should reject the replay with invalid_grant and call the SaaS exchange exactly once', async () => {
      const exchangeCode = jest.fn(async () => serverTokens());
      const { app } = buildApp(stubServerClient({ exchangeCode }));

      const first = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);
      const second = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(first.status).toBe(200);
      expect(second.status).toBe(400);
      expect(second.body.error.type).toBe('invalid_grant');
      expect(exchangeCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the resolved identity is not allowed for the rendering', () => {
    it('should map a ForbiddenError to 403 forest_identity_not_allowed', async () => {
      const { app } = buildApp(
        stubServerClient({
          getUserInfo: async () => {
            throw new ForbiddenError('nope');
          },
        }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(403);
      expect(response.body.error.type).toBe('forest_identity_not_allowed');
    });
  });

  describe('when the SaaS access token is already expired at exchange', () => {
    it('should reject with invalid_grant rather than mint a born-dead token', async () => {
      const { app } = buildApp(stubServerClient({ exchangeCode: async () => serverTokens(-10) }));

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('invalid_grant');
    });
  });

  describe('when the SaaS exchange itself fails', () => {
    it('should map the safe exchange error to invalid_grant without relaying the description', async () => {
      const { app } = buildApp(
        stubServerClient({
          exchangeCode: async () => {
            throw new OAuthExchangeError('invalid_grant', 'super-secret-saas-detail');
          },
        }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('invalid_grant');
      expect(JSON.stringify(response.body)).not.toContain('super-secret-saas-detail');
    });
  });

  describe('when an unsupported grant_type is used', () => {
    it('should reject refresh_token here (it is T5, not T4)', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .post('/oauth/token')
        .send({ grant_type: 'refresh_token', refresh_token: 'x' });

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('unsupported_grant_type');
    });
  });
});
