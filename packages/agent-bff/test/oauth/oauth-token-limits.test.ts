import type ForestServerClient from '../../src/oauth/forest-server-client';
import type { ServerTokens } from '../../src/oauth/forest-server-client';
import type { UserInfo } from '@forestadmin/forestadmin-client';

import { bodyParser } from '@koa/bodyparser';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import createAuthorizationCodeClaims from '../../src/oauth/authorization-code-claims';
import { OAuthExchangeError } from '../../src/oauth/forest-server-client';
import createOAuthRoutes from '../../src/oauth/oauth-routes';
import createSessionTokenCodec from '../../src/oauth/session-token';
import createTokenCipher from '../../src/oauth/token-cipher';

const KEY = Buffer.alloc(32, 7).toString('base64');
const CLIENT_A = 'client-a';
const REDIRECT_URI = 'http://localhost:4567/callback';
const LEGIT_CODE = 'legit-code';
const REFRESH_LIMIT_PER_SESSION = 10;
const MAX_CODE_LENGTH = 512;
const PENDING_CODES_CAP = 100;

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

function serverTokens(): ServerTokens {
  const exp = Math.floor(Date.now() / 1000) + 3600;

  return {
    saasAccessToken: jsonwebtoken.sign({ meta: { renderingId: 17 }, exp }, 'saas-secret'),
    saasRefreshToken: 'SAAS-REFRESH-STATIC',
    renderingId: 17,
    expiresAt: exp,
  };
}

function buildApp(allowedOAuthClients?: string[]) {
  const exchangeCode = jest.fn(async ({ code }: { code: string }) => {
    if (code === LEGIT_CODE) return serverTokens();

    throw new OAuthExchangeError('invalid_grant', 'unknown code');
  });
  const refreshServerToken = jest.fn(async () => serverTokens());
  const getRegisteredClient = jest.fn(async (clientId: string) => ({
    client_id: clientId,
    redirect_uris: [REDIRECT_URI],
  }));
  const serverClient = {
    getRegisteredClient,
    exchangeCode,
    getUserInfo: async () => USER,
    refreshServerToken,
  } as unknown as ForestServerClient;

  const app = new Koa();
  app.use(bodyParser());
  app.use(
    createOAuthRoutes({
      serverClient,
      sessionTokens: createSessionTokenCodec(createTokenCipher(KEY), {
        now: () => Date.now(),
        sessionTtlSeconds: 3600,
        logger: () => undefined,
      }),
      authorizationCodes: createAuthorizationCodeClaims({
        now: () => Date.now(),
        maxPending: PENDING_CODES_CAP,
      }),
      forestAppUrl: 'https://app.forestadmin.com',
      authSecret: 'auth-secret',
      resolveEnvironmentId: async () => 99,
      logger: () => undefined,
      allowedOAuthClients,
    }),
  );

  return { app, exchangeCode, refreshServerToken, getRegisteredClient };
}

function codeGrant(code: string, clientId = CLIENT_A) {
  return {
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    code_verifier: 'a'.repeat(64),
    redirect_uri: REDIRECT_URI,
  };
}

async function postSequentially(app: Koa, bodies: object[]): Promise<number[]> {
  const statuses: number[] = [];

  for (const body of bodies) {
    // eslint-disable-next-line no-await-in-loop
    const response = await request(app.callback()).post('/oauth/token').send(body);
    statuses.push(response.status);
  }

  return statuses;
}

describe('oauth-routes POST /oauth/token limits', () => {
  describe('when one refresh token is presented again and again', () => {
    it('should call the Forest server at most the per-session limit and answer 429 past it', async () => {
      const { app, refreshServerToken } = buildApp();
      const signIn = await request(app.callback()).post('/oauth/token').send(codeGrant(LEGIT_CODE));
      const refreshBody = { grant_type: 'refresh_token', refresh_token: signIn.body.refresh_token };

      const statuses = await postSequentially(app, Array(200).fill(refreshBody));

      expect(refreshServerToken).toHaveBeenCalledTimes(REFRESH_LIMIT_PER_SESSION);
      expect(statuses.filter(status => status === 200)).toHaveLength(REFRESH_LIMIT_PER_SESSION);
      expect(statuses.filter(status => status === 429)).toHaveLength(
        200 - REFRESH_LIMIT_PER_SESSION,
      );
    });

    it('should answer the refused refresh with too_many_requests and Retry-After', async () => {
      const { app } = buildApp();
      const signIn = await request(app.callback()).post('/oauth/token').send(codeGrant(LEGIT_CODE));
      const refreshBody = { grant_type: 'refresh_token', refresh_token: signIn.body.refresh_token };
      await postSequentially(app, Array(REFRESH_LIMIT_PER_SESSION).fill(refreshBody));

      const refused = await request(app.callback()).post('/oauth/token').send(refreshBody);

      expect(refused.status).toBe(429);
      expect(refused.body).toEqual({
        error: 'too_many_requests',
        error_description: expect.stringContaining('refresh'),
      });
      expect(Number(refused.headers['retry-after'])).toBeGreaterThanOrEqual(1);
      expect(Number(refused.headers['retry-after'])).toBeLessThanOrEqual(60);
    });

    it('should make no Forest call of any kind past the limit, client allowlist lookup included', async () => {
      const { app, refreshServerToken, getRegisteredClient } = buildApp(['localhost']);
      const signIn = await request(app.callback()).post('/oauth/token').send(codeGrant(LEGIT_CODE));
      const refreshBody = { grant_type: 'refresh_token', refresh_token: signIn.body.refresh_token };
      await postSequentially(app, Array(REFRESH_LIMIT_PER_SESSION).fill(refreshBody));
      refreshServerToken.mockClear();
      getRegisteredClient.mockClear();

      const statuses = await postSequentially(app, Array(20).fill(refreshBody));

      expect(new Set(statuses)).toEqual(new Set([429]));
      expect(refreshServerToken).not.toHaveBeenCalled();
      expect(getRegisteredClient).not.toHaveBeenCalled();
    });

    it('should not count a token that cannot be opened against any session', async () => {
      const { app, refreshServerToken } = buildApp();

      const statuses = await postSequentially(
        app,
        Array.from({ length: 50 }, (_, i) => ({
          grant_type: 'refresh_token',
          refresh_token: `garbage-${i}`,
        })),
      );

      expect(new Set(statuses)).toEqual(new Set([400]));
      expect(refreshServerToken).not.toHaveBeenCalled();
    });
  });

  describe('when never-issued codes flood the endpoint', () => {
    it('should still let a legitimate user of the same client sign in', async () => {
      const { app } = buildApp();
      const junkStatuses = await postSequentially(
        app,
        Array.from({ length: 2 * PENDING_CODES_CAP }, (_, i) => codeGrant(`junk-${i}`)),
      );

      const legit = await request(app.callback()).post('/oauth/token').send(codeGrant(LEGIT_CODE));

      expect(new Set(junkStatuses)).toEqual(new Set([400]));
      expect(legit.status).toBe(200);
      expect(legit.body.error).toBeUndefined();
    });
  });

  describe('when the authorization code is longer than the cap', () => {
    it('should reject it with invalid_request before any Forest call', async () => {
      const { app, exchangeCode, getRegisteredClient } = buildApp();

      const response = await request(app.callback())
        .post('/oauth/token')
        .send(codeGrant('c'.repeat(MAX_CODE_LENGTH + 1)));

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'invalid_request',
        error_description: expect.stringContaining('code'),
      });
      expect(getRegisteredClient).not.toHaveBeenCalled();
      expect(exchangeCode).not.toHaveBeenCalled();
    });

    it('should accept a code exactly at the cap', async () => {
      const { app, exchangeCode } = buildApp();
      const code = 'c'.repeat(MAX_CODE_LENGTH);

      await request(app.callback()).post('/oauth/token').send(codeGrant(code));

      expect(exchangeCode).toHaveBeenCalledWith(expect.objectContaining({ code }));
    });
  });
});
