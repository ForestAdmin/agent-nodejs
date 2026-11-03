import type AiProxyClient from '../../src/ai/ai-proxy-client';
import type ForestServerClient from '../../src/oauth/forest-server-client';
import type { ServerTokens } from '../../src/oauth/forest-server-client';
import type { UserInfo } from '@forestadmin/forestadmin-client';

import { bodyParser } from '@koa/bodyparser';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import createAiRoutesMiddleware, { AI_QUERY_ROUTE } from '../../src/ai/ai-routes-middleware';
import createAuthModeMiddleware from '../../src/auth/auth-mode-middleware';
import createForestServerTokenMiddleware, {
  resolveForestServerToken,
} from '../../src/auth/forest-server-token-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import createAuthorizationCodeClaims from '../../src/oauth/authorization-code-claims';
import { OAuthExchangeError } from '../../src/oauth/forest-server-client';
import createOAuthRoutes from '../../src/oauth/oauth-routes';
import createSessionTokenCodec from '../../src/oauth/session-token';
import createTokenCipher from '../../src/oauth/token-cipher';

const AUTH_SECRET = 'auth-secret';
const KEY = Buffer.alloc(32, 6).toString('base64');
const CLIENT_ID = 'client-123';
const REDIRECT_URI = 'http://localhost:4567/callback';
const RENDERING_ID = 17;
const REPLAY_WINDOW_MS = 60_000;
const SERVER_TOKEN_PROBE = '/probe/forest-server-token';

const USER: UserInfo = {
  id: 42,
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  team: 'Support',
  renderingId: RENDERING_ID,
  role: 'Admin',
  tags: {},
  permissionLevel: 'admin',
};

const CODE_GRANT = {
  grant_type: 'authorization_code',
  code: 'auth-code-1',
  client_id: CLIENT_ID,
  code_verifier: 'a'.repeat(64),
  redirect_uri: REDIRECT_URI,
};

function issueServerPair(refreshToken: string): ServerTokens {
  const exp = Math.floor(Date.now() / 1000) + 3600;

  return {
    saasAccessToken: jsonwebtoken.sign(
      { meta: { renderingId: RENDERING_ID }, exp, jti: refreshToken },
      'saas-secret',
    ),
    saasRefreshToken: refreshToken,
    renderingId: RENDERING_ID,
    expiresAt: exp,
  };
}

function createIdempotentForestServer(now: () => number) {
  const live = new Set<string>();
  const replays = new Map<string, { pair: ServerTokens; at: number }>();
  const validAccess = new Set<string>();
  let rotations = 0;
  let held: { expected: number; waiting: number; release: () => void } | undefined;
  let pending: Promise<void> = Promise.resolve();

  function grant(): ServerTokens {
    rotations += 1;
    const pair = issueServerPair(`saas-refresh-${rotations}`);
    live.add(pair.saasRefreshToken);
    validAccess.add(pair.saasAccessToken);

    return pair;
  }

  function revokeGrant(): void {
    live.clear();
    replays.clear();
    validAccess.clear();
  }

  function rotate(presented: string): ServerTokens {
    const replay = replays.get(presented);
    if (replay && now() - replay.at <= REPLAY_WINDOW_MS) return replay.pair;

    if (!live.delete(presented)) {
      revokeGrant();
      throw new OAuthExchangeError('invalid_grant', 'refresh token reused');
    }

    const pair = grant();
    replays.set(presented, { pair, at: now() });

    return pair;
  }

  const client = {
    getRegisteredClient: async () => ({ client_id: CLIENT_ID, redirect_uris: [REDIRECT_URI] }),
    exchangeCode: async () => grant(),
    getUserInfo: async () => USER,
    refreshServerToken: async ({ refreshToken }: { refreshToken: string }) => {
      if (held) {
        held.waiting += 1;
        if (held.waiting === held.expected) held.release();
      }

      await pending;

      return rotate(refreshToken);
    },
  } as unknown as ForestServerClient;

  return {
    client,
    holdRefreshesUntil(expected: number): void {
      pending = new Promise<void>(resolve => {
        held = { expected, waiting: 0, release: resolve };
      });
    },
    rotations: () => rotations,
    accepts: (saasAccessToken: string) => validAccess.has(saasAccessToken),
  };
}

function createInstance(serverClient: ForestServerClient, aiQuery: jest.Mock) {
  const now = () => Date.now();
  const logger = () => undefined;
  const sessionTokens = createSessionTokenCodec(createTokenCipher(KEY), {
    now,
    sessionTtlSeconds: 24 * 60 * 60,
    logger,
  });
  const app = new Koa();

  app.use(createErrorMiddleware({ logger }));
  app.use(bodyParser());
  app.use(
    createOAuthRoutes({
      serverClient,
      sessionTokens,
      authorizationCodes: createAuthorizationCodeClaims({ now }),
      forestAppUrl: 'https://app.forestadmin.com',
      authSecret: AUTH_SECRET,
      resolveEnvironmentId: async () => 99,
      logger,
    }),
  );
  app.use(createAuthModeMiddleware({ authSecret: AUTH_SECRET }));
  app.use(createForestServerTokenMiddleware({ session: { sessionTokens }, logger }));
  app.use(
    createAiRoutesMiddleware({
      client: { query: aiQuery } as unknown as AiProxyClient,
      sessionTokens,
      resolveEnvironmentId: async () => 99,
      logger,
    }),
  );
  app.use(async (ctx, next) => {
    if (ctx.path !== SERVER_TOKEN_PROBE) return next();

    ctx.body = { forestServerToken: await resolveForestServerToken(ctx) };
  });

  return app;
}

function aiQueryOk(): jest.Mock {
  return jest.fn(async () => ({ status: 200, body: { choices: [] }, isJson: true }));
}

async function signIn(app: Koa) {
  const response = await request(app.callback()).post('/oauth/token').send(CODE_GRANT);
  expect(response.status).toBe(200);

  return response.body as { access_token: string; refresh_token: string };
}

function refresh(app: Koa, refreshToken: string) {
  return request(app.callback())
    .post('/oauth/token')
    .send({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

function askAi(app: Koa, accessToken: string) {
  return request(app.callback())
    .post(AI_QUERY_ROUTE)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ messages: [] });
}

function resolveServerToken(app: Koa, accessToken: string) {
  return request(app.callback())
    .get(SERVER_TOKEN_PROBE)
    .set('Authorization', `Bearer ${accessToken}`);
}

describe('OAuth sessions across BFF instances sharing the configuration', () => {
  it('should serve an AI query and resolve the action audit credential on B for a session created on A', async () => {
    const server = createIdempotentForestServer(() => Date.now());
    const aiQueryOnB = aiQueryOk();
    const a = createInstance(server.client, aiQueryOk());
    const b = createInstance(server.client, aiQueryOnB);

    const { access_token: accessToken } = await signIn(a);

    const ai = await askAi(b, accessToken);
    const audit = await resolveServerToken(b, accessToken);

    expect(ai.status).toBe(200);
    expect(aiQueryOnB).toHaveBeenCalledWith(
      expect.objectContaining({ saasAccessToken: audit.body.forestServerToken }),
    );
    expect(audit.status).toBe(200);
    expect(server.accepts(audit.body.forestServerToken)).toBe(true);
  });

  it('should keep the user signed in when B refreshes a token issued on A', async () => {
    const server = createIdempotentForestServer(() => Date.now());
    const a = createInstance(server.client, aiQueryOk());
    const b = createInstance(server.client, aiQueryOk());
    const session = await signIn(a);

    const refreshed = await refresh(b, session.refresh_token);
    const ai = await askAi(a, refreshed.body.access_token);
    const again = await refresh(a, refreshed.body.refresh_token);

    expect(refreshed.status).toBe(200);
    expect(ai.status).toBe(200);
    expect(again.status).toBe(200);
  });

  it('should commit exactly one rotation when A and B refresh the same token concurrently', async () => {
    const server = createIdempotentForestServer(() => Date.now());
    const a = createInstance(server.client, aiQueryOk());
    const b = createInstance(server.client, aiQueryOk());
    const session = await signIn(a);
    const rotationsAtSignIn = server.rotations();

    server.holdRefreshesUntil(2);
    const [onA, onB] = await Promise.all([
      refresh(a, session.refresh_token),
      refresh(b, session.refresh_token),
    ]);

    expect([onA.status, onB.status]).toEqual([200, 200]);
    expect(server.rotations()).toBe(rotationsAtSignIn + 1);

    const [fromA, fromB] = await Promise.all([
      resolveServerToken(a, onA.body.access_token),
      resolveServerToken(b, onB.body.access_token),
    ]);
    expect(fromA.body.forestServerToken).toBe(fromB.body.forestServerToken);
    expect(server.accepts(fromA.body.forestServerToken)).toBe(true);
    expect((await refresh(b, onA.body.refresh_token)).status).toBe(200);
  });

  it('should serve the session after a restart within its lifetime', async () => {
    const server = createIdempotentForestServer(() => Date.now());
    const beforeRestart = createInstance(server.client, aiQueryOk());
    const session = await signIn(beforeRestart);

    const afterRestart = createInstance(server.client, aiQueryOk());
    const ai = await askAi(afterRestart, session.access_token);
    const refreshed = await refresh(afterRestart, session.refresh_token);

    expect(ai.status).toBe(200);
    expect(refreshed.status).toBe(200);
  });

  it('should kill the session when an older rotated-out refresh token comes back', async () => {
    let clock = Date.now();
    const server = createIdempotentForestServer(() => clock);
    const a = createInstance(server.client, aiQueryOk());
    const b = createInstance(server.client, aiQueryOk());
    const session = await signIn(a);
    const live = (await refresh(a, session.refresh_token)).body.refresh_token as string;

    clock += REPLAY_WINDOW_MS + 1;
    const stolen = await refresh(b, session.refresh_token);
    const legitimate = await refresh(a, live);

    expect(stolen.status).toBe(400);
    expect(stolen.body.error).toBe('invalid_grant');
    expect(legitimate.status).toBe(400);
    expect(legitimate.body.error).toBe('invalid_grant');
  });
});
