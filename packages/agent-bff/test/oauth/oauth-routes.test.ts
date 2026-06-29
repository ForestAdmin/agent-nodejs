import type ForestServerClient from '../../src/oauth/forest-server-client';
import type { ServerTokens } from '../../src/oauth/forest-server-client';
import type { LoggerLevel } from '../../src/ports/logger-port';
import type { UserInfo } from '@forestadmin/forestadmin-client';

import { ForbiddenError, NotFoundError } from '@forestadmin/forestadmin-client';
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

function buildApp(serverClient: ForestServerClient, forestAppUrl: string = APP_URL) {
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
      forestAppUrl,
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

const CODE_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const AUTHORIZE_QUERY = {
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  code_challenge: CODE_CHALLENGE,
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
      expect(location.searchParams.get('code_challenge')).toBe(CODE_CHALLENGE);
      expect(location.searchParams.get('environmentId')).toBe('99');
      expect(location.searchParams.get('state')).toBe('state-xyz');
    });

    it('should preserve a path prefix already present in the Forest app url', async () => {
      const { app } = buildApp(stubServerClient(), 'https://app.forestadmin.com/prefix');

      const response = await request(app.callback()).get('/oauth/authorize').query(AUTHORIZE_QUERY);

      expect(response.status).toBe(302);
      const location = new URL(response.headers.location);
      expect(location.pathname).toBe('/prefix/oauth/authorize');
    });
  });

  describe('when a required param is missing after redirect_uri is validated', () => {
    it('should redirect the error back to redirect_uri with error and state', async () => {
      const { app } = buildApp(stubServerClient());
      const incomplete = { ...AUTHORIZE_QUERY };
      delete (incomplete as Partial<typeof AUTHORIZE_QUERY>).code_challenge;

      const response = await request(app.callback()).get('/oauth/authorize').query(incomplete);

      expect(response.status).toBe(302);
      const location = new URL(response.headers.location);
      expect(location.origin + location.pathname).toBe(REDIRECT_URI);
      expect(location.searchParams.get('error')).toBe('invalid_request');
      expect(location.searchParams.get('state')).toBe('state-xyz');
    });
  });

  describe('when the client_id is not registered', () => {
    it('should reject with invalid_request and not redirect (redirect_uri unverified)', async () => {
      const { app } = buildApp(stubServerClient({ getRegisteredClient: async () => undefined }));

      const response = await request(app.callback()).get('/oauth/authorize').query(AUTHORIZE_QUERY);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      expect(response.headers.location).toBeUndefined();
    });
  });

  describe('when code_challenge is malformed', () => {
    it('should redirect the error back to redirect_uri', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, code_challenge: 'too-short' });

      expect(response.status).toBe(302);
      const location = new URL(response.headers.location);
      expect(location.origin + location.pathname).toBe(REDIRECT_URI);
      expect(location.searchParams.get('error')).toBe('invalid_request');
    });

    it('should reject a non-base64url S256 challenge even when its length is valid', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, code_challenge: '.'.repeat(43) });

      expect(response.status).toBe(302);
      const location = new URL(response.headers.location);
      expect(location.origin + location.pathname).toBe(REDIRECT_URI);
      expect(location.searchParams.get('error')).toBe('invalid_request');
    });
  });

  describe('when code_challenge_method is not S256', () => {
    it('should redirect the PKCE downgrade error back to redirect_uri', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, code_challenge_method: 'plain' });

      expect(response.status).toBe(302);
      expect(new URL(response.headers.location).searchParams.get('error')).toBe('invalid_request');
    });

    it('should redirect a missing code_challenge_method (S256 is mandatory, not defaulted)', async () => {
      const { app } = buildApp(stubServerClient());
      const query = { ...AUTHORIZE_QUERY };
      delete (query as Partial<typeof AUTHORIZE_QUERY>).code_challenge_method;

      const response = await request(app.callback()).get('/oauth/authorize').query(query);

      expect(response.status).toBe(302);
      expect(new URL(response.headers.location).searchParams.get('error')).toBe('invalid_request');
    });

    it('should redirect an empty code_challenge (presence check rejects empty, not just missing)', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, code_challenge: '' });

      expect(response.status).toBe(302);
      expect(new URL(response.headers.location).searchParams.get('error')).toBe('invalid_request');
    });
  });

  describe('when a query param is repeated (array value)', () => {
    it('should reject with invalid_request and not redirect', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, client_id: [CLIENT_ID, 'other'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      expect(response.headers.location).toBeUndefined();
    });

    it('should redirect a repeated state error after redirect_uri is trusted', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, state: ['state-1', 'state-2'] });

      expect(response.status).toBe(302);
      const location = new URL(response.headers.location);
      expect(location.origin + location.pathname).toBe(REDIRECT_URI);
      expect(location.searchParams.get('error')).toBe('invalid_request');
      expect(location.searchParams.get('state')).toBeNull();
    });
  });

  describe('when the registered client has no redirect_uris', () => {
    it('should fail closed with invalid_request instead of accepting any redirect_uri', async () => {
      const { app } = buildApp(
        stubServerClient({ getRegisteredClient: async () => ({ client_id: CLIENT_ID }) }),
      );

      const response = await request(app.callback()).get('/oauth/authorize').query(AUTHORIZE_QUERY);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
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
      expect(response.body.error).toBe('invalid_request');
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
      expect(response.body.error).toBe('invalid_grant');
      expect(exchangeCode).not.toHaveBeenCalled();
    });
  });

  describe('when local validation fails', () => {
    it('should reject a missing field with invalid_request and call no SaaS', async () => {
      const exchangeCode = jest.fn(async () => serverTokens());
      const { app } = buildApp(stubServerClient({ exchangeCode }));
      const incomplete = { ...TOKEN_BODY };
      delete (incomplete as Partial<typeof TOKEN_BODY>).code_verifier;

      const response = await request(app.callback()).post('/oauth/token').send(incomplete);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      expect(response.body.error_description).toEqual(expect.any(String));
      expect(exchangeCode).not.toHaveBeenCalled();
    });

    it('should reject an unknown client with invalid_client and call no SaaS exchange', async () => {
      const exchangeCode = jest.fn(async () => serverTokens());
      const { app } = buildApp(
        stubServerClient({ exchangeCode, getRegisteredClient: async () => undefined }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_client');
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
      expect(second.body.error).toBe('invalid_grant');
      expect(exchangeCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the exchange itself fails transiently', () => {
    it('should release the code so the same request can be retried successfully', async () => {
      let attempts = 0;
      const exchangeCode = jest.fn(async () => {
        attempts += 1;
        if (attempts === 1) throw new OAuthExchangeError('temporarily_unavailable', 'blip');

        return serverTokens();
      });
      const { app } = buildApp(stubServerClient({ exchangeCode }));

      const first = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);
      const second = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(first.status).toBe(502);
      expect(second.status).toBe(200);
      expect(second.body.token_type).toBe('Bearer');
    });
  });

  describe('when the exchange is rejected with a non-retriable error', () => {
    it('should keep the code claimed so the rejected code cannot be replayed', async () => {
      const exchangeCode = jest.fn(async () => {
        throw new OAuthExchangeError('invalid_grant', 'spent upstream');
      });
      const { app } = buildApp(stubServerClient({ exchangeCode }));

      const first = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);
      const second = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(first.status).toBe(400);
      expect(first.body.error).toBe('invalid_grant');
      expect(second.status).toBe(400);
      expect(second.body.error).toBe('invalid_grant');
      expect(exchangeCode).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a failure happens after a successful exchange', () => {
    it('should keep the code claimed since it is already spent upstream', async () => {
      let attempts = 0;
      const getUserInfo = jest.fn(async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('network blip');

        return USER;
      });
      const { app } = buildApp(stubServerClient({ getUserInfo }));

      const first = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);
      const second = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(first.status).toBe(502);
      expect(first.body.error).toBe('identity_resolution_failed');
      expect(second.status).toBe(400);
      expect(second.body.error).toBe('invalid_grant');
    });
  });

  describe('when issuing the token response', () => {
    it('should mark it non-cacheable per OAuth requirements', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers.pragma).toBe('no-cache');
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
      expect(response.body.error).toBe('forest_identity_not_allowed');
    });

    it('should map a NotFoundError to a non-permanent 502 rather than a 403', async () => {
      const { app } = buildApp(
        stubServerClient({
          getUserInfo: async () => {
            throw new NotFoundError('missing rendering');
          },
        }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('identity_resolution_failed');
    });
  });

  describe('when the SaaS access token is already expired at exchange', () => {
    it('should reject with invalid_grant rather than mint a born-dead token', async () => {
      const { app } = buildApp(stubServerClient({ exchangeCode: async () => serverTokens(-10) }));

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_grant');
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
      expect(response.body.error).toBe('invalid_grant');
      expect(JSON.stringify(response.body)).not.toContain('super-secret-saas-detail');
    });
  });

  describe('when the SaaS exchange fails with an unsafe error code', () => {
    it('should map it to 502 server_error without exposing the upstream code', async () => {
      const { app } = buildApp(
        stubServerClient({
          exchangeCode: async () => {
            throw new OAuthExchangeError('some_unknown_upstream_error', 'super-secret-saas-detail');
          },
        }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('server_error');
      expect(JSON.stringify(response.body)).not.toContain('some_unknown_upstream_error');
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
      expect(response.body.error).toBe('unsupported_grant_type');
    });
  });

  describe('when the code_verifier is malformed', () => {
    it('should reject with invalid_request before exchanging', async () => {
      const exchangeCode = jest.fn(async () => serverTokens());
      const { app } = buildApp(stubServerClient({ exchangeCode }));

      const response = await request(app.callback())
        .post('/oauth/token')
        .send({ ...TOKEN_BODY, code_verifier: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
      expect(exchangeCode).not.toHaveBeenCalled();
    });
  });

  describe('when the request body is missing (no parsed body)', () => {
    it('should reject with invalid_request', async () => {
      const sessionStore = createInMemorySessionStore({
        cipher: createTokenCipher(KEY),
        now: () => Date.now(),
        sessionTtlSeconds: 3600,
      });
      const app = new Koa();
      app.use(
        createOAuthRoutes({
          serverClient: stubServerClient(),
          sessionStore,
          forestAppUrl: APP_URL,
          authSecret: AUTH_SECRET,
          environmentId: 99,
          logger: () => undefined,
        }),
      );

      const response = await request(app.callback()).post('/oauth/token');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });
  });

  describe('when identity resolution throws a generic error', () => {
    it('should map it to 502 identity_resolution_failed', async () => {
      const { app } = buildApp(
        stubServerClient({
          getUserInfo: async () => {
            throw new Error('network blip');
          },
        }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('identity_resolution_failed');
    });
  });

  describe('when the SaaS exchange throws a non-OAuthExchangeError', () => {
    it('should surface a 500 server_error and not leak the cause', async () => {
      const { app } = buildApp(
        stubServerClient({
          exchangeCode: async () => {
            throw new Error('super-secret-internal-detail');
          },
        }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('server_error');
      expect(JSON.stringify(response.body)).not.toContain('super-secret-internal-detail');
    });

    it('should log the failure cause for the operator without leaking it to the client', async () => {
      const { app, logs } = buildApp(
        stubServerClient({
          exchangeCode: async () => {
            throw new Error('upstream decode boom');
          },
        }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      const failure = logs.find(
        log => log.level === 'Error' && log.message === 'OAuth route failure',
      );
      expect(failure?.context?.cause).toBe('Error: upstream decode boom');
      expect(JSON.stringify(response.body)).not.toContain('upstream decode boom');
    });
  });
});

describe('oauth-routes middleware', () => {
  describe('when the response_type is not code', () => {
    it('should redirect invalid_request back to the validated redirect_uri', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, response_type: 'token' });

      expect(response.status).toBe(302);
      expect(new URL(response.headers.location).searchParams.get('error')).toBe('invalid_request');
    });
  });

  describe('when a route handler throws a non-OAuth error', () => {
    it('should write a 500 server_error', async () => {
      const { app } = buildApp(
        stubServerClient({
          getRegisteredClient: async () => {
            throw new Error('plain boom');
          },
        }),
      );

      const response = await request(app.callback()).get('/oauth/authorize').query(AUTHORIZE_QUERY);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('server_error');
    });
  });

  describe('when the route is not an OAuth route', () => {
    it('should pass through to the next middleware', async () => {
      const { app } = buildApp(stubServerClient());
      app.use(async ctx => {
        ctx.status = 204;
      });

      const response = await request(app.callback()).get('/something-else');

      expect(response.status).toBe(204);
    });
  });
});
