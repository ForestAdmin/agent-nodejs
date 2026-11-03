import type ForestServerClient from '../../src/oauth/forest-server-client';
import type { ServerTokens } from '../../src/oauth/forest-server-client';
import type { LoggerLevel } from '../../src/ports/logger-port';
import type { UserInfo } from '@forestadmin/forestadmin-client';

import { ForbiddenError, NotFoundError } from '@forestadmin/forestadmin-client';
import { bodyParser } from '@koa/bodyparser';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import createAuthorizationCodeClaims from '../../src/oauth/authorization-code-claims';
import { OAuthExchangeError } from '../../src/oauth/forest-server-client';
import createOAuthRoutes from '../../src/oauth/oauth-routes';
import createSessionTokenCodec from '../../src/oauth/session-token';
import createTokenCipher from '../../src/oauth/token-cipher';

const AUTH_SECRET = 'auth-secret';
const APP_URL = 'https://app.forestadmin.com';
const CLIENT_ID = 'client-123';
const REDIRECT_URI = 'http://localhost:4567/callback';
const SENTINEL_ACCESS = 'SAAS-ACCESS-SENTINEL';
const SENTINEL_REFRESH = 'SAAS-REFRESH-SENTINEL';
const KEY = Buffer.alloc(32, 5).toString('base64');
const SESSION_TTL_SECONDS = 3600;

function routeOptions(key: string = KEY) {
  return {
    sessionTokens: createSessionTokenCodec(createTokenCipher(key), () => Date.now()),
    authorizationCodes: createAuthorizationCodeClaims({ now: () => Date.now() }),
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  };
}

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

function decodableServerTokens(expFromNow = 3600): ServerTokens {
  const exp = Math.floor(Date.now() / 1000) + expFromNow;
  const saasAccessToken = jsonwebtoken.sign({ meta: { renderingId: 17 }, exp }, 'saas-secret', {
    algorithm: 'HS256',
  });

  return {
    saasAccessToken,
    saasRefreshToken: 'ROTATED-SAAS-REFRESH',
    renderingId: 17,
    expiresAt: exp,
  };
}

interface StubOverrides {
  getRegisteredClient?: ForestServerClient['getRegisteredClient'];
  exchangeCode?: ForestServerClient['exchangeCode'];
  getUserInfo?: ForestServerClient['getUserInfo'];
  refreshServerToken?: ForestServerClient['refreshServerToken'];
}

function stubServerClient(overrides: StubOverrides = {}): ForestServerClient {
  return {
    getRegisteredClient:
      overrides.getRegisteredClient ??
      (async () => ({ client_id: CLIENT_ID, redirect_uris: [REDIRECT_URI] })),
    exchangeCode: overrides.exchangeCode ?? (async () => serverTokens()),
    getUserInfo: overrides.getUserInfo ?? (async () => USER),
    refreshServerToken: overrides.refreshServerToken ?? (async () => decodableServerTokens()),
  } as unknown as ForestServerClient;
}

interface LogLine {
  level: LoggerLevel;
  message: string;
  context?: Record<string, unknown>;
}

function buildApp(
  serverClient: ForestServerClient,
  forestAppUrl: string = APP_URL,
  onTokenRequest?: () => void,
  resolveEnvironmentId: () => Promise<number> = async () => 99,
  allowedOAuthClients?: string[],
  key: string = KEY,
) {
  const logs: LogLine[] = [];

  const logger = (level: LoggerLevel, message: string, context?: Record<string, unknown>) => {
    logs.push({ level, message, context });
  };

  const options = routeOptions(key);

  const app = new Koa();
  app.use(bodyParser());

  if (onTokenRequest) {
    app.use(async (ctx, next) => {
      if (ctx.method === 'POST' && ctx.path === '/oauth/token') onTokenRequest();

      await next();
    });
  }

  app.use(
    createOAuthRoutes({
      serverClient,
      ...options,
      forestAppUrl,
      authSecret: AUTH_SECRET,
      resolveEnvironmentId,
      logger,
      allowedOAuthClients,
    }),
  );

  return { app, logs, sessionTokens: options.sessionTokens };
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

    it('should redirect server_error to the client when the environment id cannot be resolved', async () => {
      const { app, logs } = buildApp(stubServerClient(), APP_URL, undefined, async () => {
        throw new Error('forest server unreachable');
      });

      const response = await request(app.callback()).get('/oauth/authorize').query(AUTHORIZE_QUERY);

      expect(response.status).toBe(302);
      const location = new URL(response.headers.location);
      expect(location.origin + location.pathname).toBe(REDIRECT_URI);
      expect(location.searchParams.get('error')).toBe('server_error');
      expect(location.searchParams.get('state')).toBe('state-xyz');
      expect(logs).toContainEqual({
        level: 'Error',
        message: 'Could not resolve the Forest environment id',
        context: { cause: 'forest server unreachable' },
      });
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

    it('should warn when the Forest server grant carries no refresh reuse detection', async () => {
      const { app, logs } = buildApp(stubServerClient());

      await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(logs).toContainEqual({
        level: 'Warn',
        message:
          'The Forest server issued a grant without refresh reuse detection: a stolen refresh token stays usable until the session expires',
        context: { renderingId: 17, userId: USER.id },
      });
    });

    it('should not warn for a grant the Forest server tagged for rotation enforcement', async () => {
      const taggedRefresh = jsonwebtoken.sign(
        { meta: { service: 'api', gatewayGrantId: 'grant-1' } },
        'saas-secret',
      );
      const { app, logs } = buildApp(
        stubServerClient({
          exchangeCode: async () => ({ ...serverTokens(), saasRefreshToken: taggedRefresh }),
        }),
      );

      await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(logs.filter(({ level }) => level === 'Warn')).toEqual([]);
    });

    it('should not leak any SaaS token value into the logs', async () => {
      const { app, logs } = buildApp(stubServerClient());

      await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(JSON.stringify(logs)).not.toContain(SENTINEL_ACCESS);
      expect(JSON.stringify(logs)).not.toContain(SENTINEL_REFRESH);
    });

    it('should seal the session state, exchanged client id included, into the refresh token', async () => {
      const { app, sessionTokens } = buildApp(stubServerClient());
      const before = Date.now();

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);
      const { sid } = jsonwebtoken.decode(response.body.access_token) as { sid: string };
      const state = sessionTokens.openRefreshToken(response.body.refresh_token);

      expect(state).toEqual({
        sid,
        saasRefreshToken: SENTINEL_REFRESH,
        renderingId: 17,
        userId: USER.id,
        clientId: CLIENT_ID,
        expiresAt: expect.any(Number),
      });
      expect(state?.expiresAt).toBeGreaterThanOrEqual(before + SESSION_TTL_SECONDS * 1000);
      expect(state?.expiresAt).toBeLessThanOrEqual(Date.now() + SESSION_TTL_SECONDS * 1000);
    });

    it('should seal the Forest server access into the access token, bound to its session', async () => {
      const { app, sessionTokens } = buildApp(stubServerClient());

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);
      const { sid, server_access: serverAccess } = jsonwebtoken.decode(
        response.body.access_token,
      ) as { sid: string; server_access: string };

      expect(
        sessionTokens.openServerAccess(serverAccess, { sid, userId: USER.id, renderingId: 17 }),
      ).toBe(SENTINEL_ACCESS);
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

  describe('when the Forest server rejects the code as invalid_grant', () => {
    it('should release the claim and leave the replay to the Forest server', async () => {
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
      expect(exchangeCode).toHaveBeenCalledTimes(2);
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

  describe('when the Forest server refuses the exchange because the plan lacks the Gateway API', () => {
    it('should answer 403 plan_feature_missing with the flat OAuth body and keep the code claimed', async () => {
      const exchangeCode = jest.fn(async () => {
        throw new OAuthExchangeError('access_denied', 'no Gateway API', 'plan_feature_missing');
      });
      const { app, logs } = buildApp(stubServerClient({ exchangeCode }));

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);
      const replay = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: 'plan_feature_missing',
        error_description: "The project's plan does not include the Gateway API.",
      });
      expect(replay.status).toBe(400);
      expect(replay.body.error).toBe('invalid_grant');
      expect(exchangeCode).toHaveBeenCalledTimes(1);
      expect(logs).toContainEqual({
        level: 'Warn',
        message: 'Forest server code exchange rejected',
        context: { saasError: 'access_denied', reason: 'plan_feature_missing' },
      });
    });

    it('should keep the 502 server_error for an access_denied carrying another reason', async () => {
      const { app } = buildApp(
        stubServerClient({
          exchangeCode: async () => {
            throw new OAuthExchangeError('access_denied', 'other', 'something_else');
          },
        }),
      );

      const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('server_error');
    });
  });

  describe('when an unsupported grant_type is used', () => {
    it('should reject a grant_type that is neither authorization_code nor refresh_token', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .post('/oauth/token')
        .send({ grant_type: 'client_credentials', client_id: CLIENT_ID });

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
      const app = new Koa();
      app.use(
        createOAuthRoutes({
          serverClient: stubServerClient(),
          ...routeOptions(),
          forestAppUrl: APP_URL,
          authSecret: AUTH_SECRET,
          resolveEnvironmentId: async () => 99,
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

describe('oauth-routes POST /oauth/token refresh_token grant', () => {
  async function login(app: Koa): Promise<string> {
    const response = await request(app.callback()).post('/oauth/token').send(TOKEN_BODY);
    expect(response.status).toBe(200);

    return response.body.refresh_token as string;
  }

  function refresh(app: Koa, refreshToken: string) {
    return request(app.callback())
      .post('/oauth/token')
      .send({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  function singleUseRefresh() {
    const live = new Set([SENTINEL_REFRESH]);
    let issued = 0;

    return jest.fn(async ({ refreshToken }: { refreshToken: string }) => {
      if (!live.delete(refreshToken)) {
        live.clear();
        throw new OAuthExchangeError('invalid_grant', 'refresh token reused');
      }

      issued += 1;
      const rotated = { ...decodableServerTokens(), saasRefreshToken: `SAAS-REFRESH-${issued}` };
      live.add(rotated.saasRefreshToken);

      return rotated;
    });
  }

  describe('when a valid refresh token is presented', () => {
    it('should rotate the sealed Forest refresh token and return a new pair', async () => {
      const refreshServerToken = jest.fn(async () => decodableServerTokens());
      const { app, sessionTokens } = buildApp(stubServerClient({ refreshServerToken }));
      const refreshToken = await login(app);

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(200);
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBeGreaterThan(0);
      expect(typeof response.body.access_token).toBe('string');
      expect(response.body.refresh_token).not.toBe(refreshToken);
      expect(refreshServerToken).toHaveBeenCalledWith({
        refreshToken: SENTINEL_REFRESH,
        clientId: CLIENT_ID,
      });
      expect(sessionTokens.openRefreshToken(response.body.refresh_token)).toMatchObject({
        saasRefreshToken: 'ROTATED-SAAS-REFRESH',
      });
    });

    it('should keep the session id and its absolute expiry across rotations', async () => {
      const { app, sessionTokens } = buildApp(stubServerClient());
      const refreshToken = await login(app);

      const response = await refresh(app, refreshToken);

      const before = sessionTokens.openRefreshToken(refreshToken);
      const after = sessionTokens.openRefreshToken(response.body.refresh_token);
      expect(after?.sid).toBe(before?.sid);
      expect(after?.expiresAt).toBe(before?.expiresAt);
      expect((jsonwebtoken.decode(response.body.access_token) as { sid: string }).sid).toBe(
        before?.sid,
      );
    });

    it('should present the rotated Forest refresh token on the next refresh', async () => {
      const refreshServerToken = singleUseRefresh();
      const { app } = buildApp(stubServerClient({ refreshServerToken }));
      const refreshToken = await login(app);

      const first = await refresh(app, refreshToken);
      const second = await refresh(app, first.body.refresh_token as string);

      expect(second.status).toBe(200);
      expect(refreshServerToken).toHaveBeenLastCalledWith({
        refreshToken: 'SAAS-REFRESH-1',
        clientId: CLIENT_ID,
      });
    });

    it('should seal the rotated Forest server access into the new access token', async () => {
      const rotated = decodableServerTokens();
      const { app, sessionTokens } = buildApp(
        stubServerClient({ refreshServerToken: async () => rotated }),
      );
      const refreshToken = await login(app);

      const response = await refresh(app, refreshToken);
      const { sid, server_access: serverAccess } = jsonwebtoken.decode(
        response.body.access_token,
      ) as { sid: string; server_access: string };

      expect(
        sessionTokens.openServerAccess(serverAccess, { sid, userId: USER.id, renderingId: 17 }),
      ).toBe(rotated.saasAccessToken);
    });

    it('should not leak any SaaS access or refresh token in the response body or the new JWT', async () => {
      const { app } = buildApp(
        stubServerClient({ refreshServerToken: async () => decodableServerTokens() }),
      );
      const refreshToken = await login(app);

      const response = await refresh(app, refreshToken);

      const decoded = jsonwebtoken.verify(response.body.access_token, AUTH_SECRET) as Record<
        string,
        unknown
      >;
      expect(decoded.type).toBe('bff_access');
      const serialized = JSON.stringify(response.body) + JSON.stringify(decoded);
      expect(serialized).not.toContain(SENTINEL_REFRESH);
      expect(serialized).not.toContain('ROTATED-SAAS-REFRESH');
      expect(serialized).not.toContain(SENTINEL_ACCESS);
    });

    it('should mark the response non-cacheable', async () => {
      const { app } = buildApp(
        stubServerClient({ refreshServerToken: async () => decodableServerTokens() }),
      );
      const refreshToken = await login(app);

      const response = await refresh(app, refreshToken);

      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers.pragma).toBe('no-cache');
    });
  });

  describe('when a rotated-out refresh token is presented again', () => {
    it('should relay the Forest server rejection as invalid_grant', async () => {
      const { app } = buildApp(stubServerClient({ refreshServerToken: singleUseRefresh() }));
      const r1 = await login(app);
      const r2 = (await refresh(app, r1)).body.refresh_token as string;

      const replay = await refresh(app, r1);
      const afterReplay = await refresh(app, r2);

      expect(replay.status).toBe(400);
      expect(replay.body.error).toBe('invalid_grant');
      expect(afterReplay.status).toBe(400);
      expect(afterReplay.body.error).toBe('invalid_grant');
    });

    it('should leave a benign retry to the Forest server, presenting the same Forest token', async () => {
      const refreshServerToken = jest.fn(async () => decodableServerTokens());
      const { app } = buildApp(stubServerClient({ refreshServerToken }));
      const refreshToken = await login(app);

      await refresh(app, refreshToken);
      const retry = await refresh(app, refreshToken);

      expect(retry.status).toBe(200);
      expect(refreshServerToken).toHaveBeenCalledTimes(2);
      expect(refreshServerToken).toHaveBeenNthCalledWith(2, {
        refreshToken: SENTINEL_REFRESH,
        clientId: CLIENT_ID,
      });
    });
  });

  describe('when the refresh token cannot be opened', () => {
    it('should reject a token never issued with 400 invalid_grant', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await refresh(app, 'never-issued');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_grant');
    });

    it('should reject a token sealed with another key and never call the Forest server', async () => {
      const refreshServerToken = jest.fn(async () => decodableServerTokens());
      const { app } = buildApp(stubServerClient({ refreshServerToken }));
      const foreign = buildApp(
        stubServerClient(),
        APP_URL,
        undefined,
        undefined,
        undefined,
        Buffer.alloc(32, 9).toString('base64'),
      );
      const refreshToken = await login(foreign.app);

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_grant');
      expect(refreshServerToken).not.toHaveBeenCalled();
    });

    it('should reject a session past its absolute expiry with invalid_grant', async () => {
      const refreshServerToken = jest.fn(async () => decodableServerTokens());
      const { app, sessionTokens } = buildApp(stubServerClient({ refreshServerToken }));
      const expired = sessionTokens.sealRefreshToken({
        sid: 'sid-1',
        saasRefreshToken: SENTINEL_REFRESH,
        renderingId: 17,
        userId: USER.id,
        clientId: CLIENT_ID,
        expiresAt: Date.now() - 1,
      });

      const response = await refresh(app, expired);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_grant');
      expect(refreshServerToken).not.toHaveBeenCalled();
    });

    it('should reject a missing refresh_token with invalid_request', async () => {
      const { app } = buildApp(stubServerClient());

      const response = await request(app.callback())
        .post('/oauth/token')
        .send({ grant_type: 'refresh_token' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_request');
    });
  });

  describe('when the Forest server rejects the refresh token', () => {
    it.each(['invalid_grant', 'invalid_request', 'invalid_client', 'unauthorized_client'])(
      'should answer 400 invalid_grant for %s',
      async code => {
        const refreshServerToken = jest.fn(async () => {
          throw new OAuthExchangeError(code, 'saas refused');
        });
        const { app, logs } = buildApp(stubServerClient({ refreshServerToken }));
        const refreshToken = await login(app);

        const response = await refresh(app, refreshToken);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: 'invalid_grant',
          error_description: 'The Forest server rejected the refresh token',
        });
        expect(logs).toContainEqual({
          level: 'Warn',
          message: 'The Forest server rejected the session refresh',
          context: {
            renderingId: 17,
            userId: USER.id,
            error: code,
            errorDescription: 'saas refused',
          },
        });
      },
    );
  });

  describe('when the Forest server cannot serve the refresh', () => {
    it.each([
      ['an unavailable store', new OAuthExchangeError('temporarily_unavailable', 'redis down')],
      ['an unknown error code', new OAuthExchangeError('server_error', 'boom')],
      ['a transport failure', new Error('network blip')],
    ])('should answer a retryable 502 server_error on %s', async (_, failure) => {
      const refreshServerToken = jest.fn(async () => {
        throw failure;
      });
      const { app } = buildApp(stubServerClient({ refreshServerToken }));
      const refreshToken = await login(app);

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('server_error');
    });

    it('should keep the presented token usable, so a retry after the blip succeeds', async () => {
      let attempts = 0;
      const refreshServerToken = jest.fn(async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('network blip');

        return decodableServerTokens();
      });
      const { app } = buildApp(stubServerClient({ refreshServerToken }));
      const refreshToken = await login(app);

      const failed = await refresh(app, refreshToken);
      const retried = await refresh(app, refreshToken);

      expect(failed.status).toBe(502);
      expect(retried.status).toBe(200);
      expect(retried.body.refresh_token).not.toBe(refreshToken);
    });
  });

  describe('when the Forest server refuses the refresh because the plan lacks the Gateway API', () => {
    it('should answer 403 plan_feature_missing and keep the refresh token usable once Forest accepts again', async () => {
      let refused = true;
      const refreshServerToken = jest.fn(async () => {
        if (refused) {
          throw new OAuthExchangeError('access_denied', 'no Gateway API', 'plan_feature_missing');
        }

        return decodableServerTokens();
      });
      const { app } = buildApp(stubServerClient({ refreshServerToken }));
      const refreshToken = await login(app);

      const refusedResponse = await refresh(app, refreshToken);
      refused = false;
      const restoredResponse = await refresh(app, refreshToken);

      expect(refusedResponse.status).toBe(403);
      expect(refusedResponse.body).toEqual({
        error: 'plan_feature_missing',
        error_description: "The project's plan does not include the Gateway API.",
      });
      expect(restoredResponse.status).toBe(200);
      expect(restoredResponse.body.refresh_token).not.toBe(refreshToken);
    });
  });

  describe('when identity resolution fails transiently during a refresh', () => {
    it('should answer 502, so a retry presenting the same token succeeds', async () => {
      let attempts = 0;
      const getUserInfo = jest.fn(async () => {
        attempts += 1;
        if (attempts === 2) throw new Error('identity blip');

        return USER;
      });
      const { app } = buildApp(
        stubServerClient({
          getUserInfo,
          refreshServerToken: async () => decodableServerTokens(),
        }),
      );
      const refreshToken = await login(app);

      const failed = await refresh(app, refreshToken);
      const retried = await refresh(app, refreshToken);

      expect(failed.status).toBe(502);
      expect(retried.status).toBe(200);
    });
  });

  describe('when the refreshed identity is another user than the session one', () => {
    it('should reject with invalid_grant', async () => {
      let calls = 0;
      const getUserInfo = jest.fn(async () => {
        calls += 1;

        return calls === 1 ? USER : { ...USER, id: USER.id + 1 };
      });
      const { app } = buildApp(stubServerClient({ getUserInfo }));
      const refreshToken = await login(app);

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_grant');
    });
  });

  describe('when the rotated SaaS access token is already expired', () => {
    it('should reject with 401 session_expired', async () => {
      const { app } = buildApp(
        stubServerClient({ refreshServerToken: async () => decodableServerTokens(-10) }),
      );
      const refreshToken = await login(app);

      const failed = await refresh(app, refreshToken);

      expect(failed.status).toBe(401);
      expect(failed.body.error).toBe('session_expired');
    });
  });

  describe('when the session is refreshed shortly before its absolute expiry', () => {
    afterEach(() => jest.restoreAllMocks());

    it('should not issue an access token that outlives the session', async () => {
      const { app, sessionTokens } = buildApp(stubServerClient());
      const refreshToken = await login(app);
      const { expiresAt } = sessionTokens.openRefreshToken(refreshToken) ?? { expiresAt: 0 };
      const fiveMinutesBeforeExpiry = expiresAt - 5 * 60 * 1000;
      jest.spyOn(Date, 'now').mockReturnValue(fiveMinutesBeforeExpiry);

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(200);
      expect(response.body.expires_in).toBe(5 * 60);
      const { exp } = jsonwebtoken.decode(response.body.access_token) as { exp: number };
      expect(exp * 1000).toBeLessThanOrEqual(expiresAt);
    });
  });

  describe('when the Forest server does not rotate the refresh token', () => {
    it('should warn that the session keeps presenting the same Forest refresh token', async () => {
      const unrotated = async () => ({
        ...decodableServerTokens(),
        saasRefreshToken: SENTINEL_REFRESH,
      });
      const { app, logs } = buildApp(stubServerClient({ refreshServerToken: unrotated }));
      const refreshToken = await login(app);

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(200);
      expect(logs).toContainEqual({
        level: 'Warn',
        message:
          'The Forest server did not rotate the refresh token: the session keeps presenting the same one',
        context: { renderingId: 17, userId: USER.id },
      });
    });

    it('should not warn when the Forest server rotates the refresh token', async () => {
      const { app, logs } = buildApp(stubServerClient());
      const refreshToken = await login(app);

      await refresh(app, refreshToken);

      expect(logs.map(log => log.message)).not.toContain(
        'The Forest server did not rotate the refresh token: the session keeps presenting the same one',
      );
    });
  });

  describe('when the Forest server returns a non-JWT (opaque) SaaS access token', () => {
    it('should still rotate and cap expires_in at the BFF maximum', async () => {
      const opaqueTokens = async (): Promise<ServerTokens> => ({
        saasAccessToken: 'opaque-saas-access-token',
        saasRefreshToken: 'ROTATED-SAAS-REFRESH',
        renderingId: 17,
        expiresAt: 0,
      });
      const { app } = buildApp(stubServerClient({ refreshServerToken: opaqueTokens }));
      const refreshToken = await login(app);

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(200);
      expect(response.body.expires_in).toBe(15 * 60);
      expect(response.body.refresh_token).not.toBe(refreshToken);
    });

    it('should cap expires_in when the access token exp claim is non-numeric', async () => {
      const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
      const malformedJwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
        meta: { renderingId: 17 },
        exp: 'soon',
      })}.sig`;
      const nonNumericExp = async (): Promise<ServerTokens> => ({
        saasAccessToken: malformedJwt,
        saasRefreshToken: 'ROTATED-SAAS-REFRESH',
        renderingId: 17,
        expiresAt: 0,
      });
      const { app } = buildApp(stubServerClient({ refreshServerToken: nonNumericExp }));
      const refreshToken = await login(app);

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(200);
      expect(response.body.expires_in).toBe(15 * 60);
    });
  });

  describe('when another BFF instance shares the token encryption key', () => {
    it('should refresh a token the first instance issued', async () => {
      const appA = buildApp(stubServerClient());
      const appB = buildApp(stubServerClient());

      const refreshTokenFromA = await login(appA.app);

      const response = await refresh(appB.app, refreshTokenFromA);

      expect(response.status).toBe(200);
    });
  });

  describe('when two concurrent refreshes of the same token run on one instance', () => {
    it('should call the Forest server once and answer both with the same pair', async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>(resolve => {
        release = resolve;
      });
      const refreshServerToken = jest.fn(async () => {
        await gate;

        return decodableServerTokens();
      });
      let secondArrived: () => void = () => undefined;
      const bothArrived = new Promise<void>(resolve => {
        secondArrived = resolve;
      });
      let tokenRequests = 0;

      const onTokenRequest = () => {
        tokenRequests += 1;
        if (tokenRequests === 3) secondArrived();
      };

      const { app } = buildApp(stubServerClient({ refreshServerToken }), APP_URL, onTokenRequest);

      const refreshToken = await login(app);

      const both = Promise.all([refresh(app, refreshToken), refresh(app, refreshToken)]);
      await bothArrived;
      release();
      const [a, b] = await both;

      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.body.refresh_token).toBe(b.body.refresh_token);
      expect(refreshServerToken).toHaveBeenCalledTimes(1);

      const followUp = await refresh(app, a.body.refresh_token as string);
      expect(followUp.status).toBe(200);
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

describe('oauth-routes allowedOAuthClients', () => {
  const ALLOWED_REDIRECT_URI = 'https://app.dust.tt/oauth/callback';
  const ZENDESK_REDIRECT_URI = 'https://app.forestadmin.com/zendesk-oauth-redirect';

  function buildRestrictedApp(redirectUris: string[], allowedOAuthClients?: string[]) {
    const exchangeCode = jest.fn(async () => serverTokens());
    const refreshServerToken = jest.fn(async () => decodableServerTokens());
    const getRegisteredClient = jest.fn(async () => ({
      client_id: CLIENT_ID,
      redirect_uris: redirectUris,
    }));
    const built = buildApp(
      stubServerClient({ exchangeCode, getRegisteredClient, refreshServerToken }),
      APP_URL,
      undefined,
      async () => 99,
      allowedOAuthClients,
    );

    return { ...built, exchangeCode, refreshServerToken, getRegisteredClient };
  }

  describe('on GET /oauth/authorize', () => {
    it('should reject a client outside the allowed domains with a 400 invalid_client body and no redirect', async () => {
      const { app } = buildRestrictedApp([ZENDESK_REDIRECT_URI], ['claude.ai']);

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, redirect_uri: ZENDESK_REDIRECT_URI });

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({
        error: 'invalid_client',
        error_description:
          'This API only accepts approved client applications. Contact your Forest Admin administrator.',
      });
      expect(response.headers.location).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toContain('claude.ai');
    });

    it('should reject a client outside the allowed domains even when the redirect_uri is not registered', async () => {
      const { app } = buildRestrictedApp([ZENDESK_REDIRECT_URI], ['claude.ai']);

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, redirect_uri: 'https://elsewhere.example/cb' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_client');
    });

    it('should log the rejected client id and its redirect URIs', async () => {
      const { app, logs } = buildRestrictedApp([ZENDESK_REDIRECT_URI], ['claude.ai']);

      await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, redirect_uri: ZENDESK_REDIRECT_URI });

      expect(logs).toContainEqual({
        level: 'Info',
        message: 'Rejected OAuth client: redirect URIs are not all on an allowed domain',
        context: { clientId: CLIENT_ID, redirectUris: [ZENDESK_REDIRECT_URI] },
      });
    });

    it('should redirect to the Forest authorize url for a client on an allowed domain', async () => {
      const { app } = buildRestrictedApp([ALLOWED_REDIRECT_URI], ['dust.tt']);

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, redirect_uri: ALLOWED_REDIRECT_URI });

      expect(response.status).toBe(302);
      const location = new URL(response.headers.location);
      expect(location.origin + location.pathname).toBe(`${APP_URL}/oauth/authorize`);
      expect(location.searchParams.get('redirect_uri')).toBe(ALLOWED_REDIRECT_URI);
    });

    it('should accept any registered client when no allowlist is set', async () => {
      const { app } = buildRestrictedApp([ZENDESK_REDIRECT_URI]);

      const response = await request(app.callback())
        .get('/oauth/authorize')
        .query({ ...AUTHORIZE_QUERY, redirect_uri: ZENDESK_REDIRECT_URI });

      expect(response.status).toBe(302);
      expect(new URL(response.headers.location).pathname).toBe('/oauth/authorize');
    });
  });

  describe('on POST /oauth/token with grant_type=authorization_code', () => {
    it('should reject a client outside the allowed domains with invalid_client and call no SaaS exchange', async () => {
      const { app, exchangeCode } = buildRestrictedApp([ZENDESK_REDIRECT_URI], ['claude.ai']);

      const response = await request(app.callback())
        .post('/oauth/token')
        .send({ ...TOKEN_BODY, redirect_uri: ZENDESK_REDIRECT_URI });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_client');
      expect(JSON.stringify(response.body)).not.toContain('claude.ai');
      expect(exchangeCode).not.toHaveBeenCalled();
    });

    it('should issue tokens to a client on an allowed domain', async () => {
      const { app, exchangeCode } = buildRestrictedApp([ALLOWED_REDIRECT_URI], ['dust.tt']);

      const response = await request(app.callback())
        .post('/oauth/token')
        .send({ ...TOKEN_BODY, redirect_uri: ALLOWED_REDIRECT_URI });

      expect(response.status).toBe(200);
      expect(response.body.token_type).toBe('Bearer');
      expect(exchangeCode).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: CLIENT_ID, redirectUri: ALLOWED_REDIRECT_URI }),
      );
    });

    it('should issue tokens to any registered client when no allowlist is set', async () => {
      const { app } = buildRestrictedApp([ZENDESK_REDIRECT_URI]);

      const response = await request(app.callback())
        .post('/oauth/token')
        .send({ ...TOKEN_BODY, redirect_uri: ZENDESK_REDIRECT_URI });

      expect(response.status).toBe(200);
      expect(response.body.token_type).toBe('Bearer');
    });
  });

  describe('on POST /oauth/token with grant_type=refresh_token', () => {
    async function signIn(app: Koa, redirectUri: string): Promise<string> {
      const response = await request(app.callback())
        .post('/oauth/token')
        .send({ ...TOKEN_BODY, redirect_uri: redirectUri });
      expect(response.status).toBe(200);

      return response.body.refresh_token as string;
    }

    function refresh(app: Koa, refreshToken: string) {
      return request(app.callback())
        .post('/oauth/token')
        .send({ grant_type: 'refresh_token', refresh_token: refreshToken });
    }

    it('should reject a session whose client left the allowed domains, without refreshing it', async () => {
      const before = buildRestrictedApp([ZENDESK_REDIRECT_URI]);
      const refreshToken = await signIn(before.app, ZENDESK_REDIRECT_URI);
      const after = buildRestrictedApp([ZENDESK_REDIRECT_URI], ['claude.ai']);

      const response = await refresh(after.app, refreshToken);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_client');
      expect(after.refreshServerToken).not.toHaveBeenCalled();
    });

    it('should reject a session whose client is no longer registered', async () => {
      const before = buildRestrictedApp([ALLOWED_REDIRECT_URI], ['dust.tt']);
      const refreshToken = await signIn(before.app, ALLOWED_REDIRECT_URI);
      const after = buildRestrictedApp([ALLOWED_REDIRECT_URI], ['dust.tt']);
      after.getRegisteredClient.mockResolvedValue(undefined as never);

      const response = await refresh(after.app, refreshToken);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_client');
      expect(after.refreshServerToken).not.toHaveBeenCalled();
    });

    it('should refresh a session whose client is on an allowed domain', async () => {
      const { app, refreshServerToken } = buildRestrictedApp([ALLOWED_REDIRECT_URI], ['dust.tt']);
      const refreshToken = await signIn(app, ALLOWED_REDIRECT_URI);

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(200);
      expect(refreshServerToken).toHaveBeenCalledWith({
        refreshToken: SENTINEL_REFRESH,
        clientId: CLIENT_ID,
      });
    });

    it('should not look the client up again when no allowlist is set', async () => {
      const { app, getRegisteredClient } = buildRestrictedApp([ZENDESK_REDIRECT_URI]);
      const refreshToken = await signIn(app, ZENDESK_REDIRECT_URI);
      getRegisteredClient.mockClear();

      const response = await refresh(app, refreshToken);

      expect(response.status).toBe(200);
      expect(getRegisteredClient).not.toHaveBeenCalled();
    });
  });
});
