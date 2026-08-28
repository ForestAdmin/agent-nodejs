import type { ApiKeyAuthenticator } from '../../src/api-key/api-key-authenticator';

import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import createApiKeyMiddleware, { BFF_KEY_HEADER } from '../../src/api-key/api-key-middleware';
import createAuthModeMiddleware from '../../src/auth/auth-mode-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import createRateLimitMiddleware from '../../src/rate-limit/rate-limit-middleware';

const AUTH_SECRET = 'secret';
const RAW_KEY = `fbff_${'a'.repeat(16)}_${'b'.repeat(64)}`;
const OTHER_KEY = `fbff_${'c'.repeat(16)}_${'d'.repeat(64)}`;

function identity(userId: number, renderingId = 1) {
  return {
    user: {
      id: userId,
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      team: 'T',
      tags: [],
      permissionLevel: 'admin',
    },
    renderingId,
    allowedOrigins: [],
  };
}

function bearerToken(id = 1, renderingId = '1') {
  return jsonwebtoken.sign(
    { type: 'bff_access', sid: 's1', id, rendering_id: renderingId, tags: {} },
    AUTH_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' },
  );
}

// The limiter sits behind the auth middlewares in production; this chain mirrors that order and
// answers 200 past them, so a 429 can only come from the limiter itself.
function buildEdge(
  limiter: ReturnType<typeof createRateLimitMiddleware>,
  authenticate: ApiKeyAuthenticator['authenticate'] = async () => ({
    agentToken: 'token',
    identity: identity(1),
  }),
) {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: () => undefined }));
  app.use(createAuthModeMiddleware({ authSecret: AUTH_SECRET }));
  app.use(createApiKeyMiddleware({ authenticator: { authenticate }, logger: () => undefined }));
  app.use(limiter);
  app.use(async ctx => {
    ctx.status = 200;
    ctx.body = { ok: true };
  });

  return app.callback();
}

describe('rate limit middleware', () => {
  it('answers 429 too_many_requests with Retry-After once the per-identity window is exhausted', async () => {
    const current = 1_000_000;
    const edge = buildEdge(
      createRateLimitMiddleware({ now: () => current, maxRequests: 2, windowMs: 60_000 }),
    );

    const first = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);
    const second = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);
    const third = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body.error).toMatchObject({ type: 'too_many_requests', status: 429 });
    expect(third.headers['retry-after']).toBe('60');
  });

  it('keeps one budget per identity, so one exhausted key does not throttle another', async () => {
    const authenticate: ApiKeyAuthenticator['authenticate'] = async rawKey =>
      rawKey === RAW_KEY
        ? { agentToken: 'token', identity: identity(1) }
        : { agentToken: 'token', identity: identity(2) };

    const edge = buildEdge(
      createRateLimitMiddleware({ now: () => 1_000_000, maxRequests: 1, windowMs: 60_000 }),
      authenticate,
    );

    const exhausted = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);
    const throttled = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);
    const fresh = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, OTHER_KEY);

    expect(exhausted.status).toBe(200);
    expect(throttled.status).toBe(429);
    expect(fresh.status).toBe(200);
  });

  it('separates budgets per rendering, so the same user on two renderings keeps two windows', async () => {
    const authenticate: ApiKeyAuthenticator['authenticate'] = async rawKey =>
      rawKey === RAW_KEY
        ? { agentToken: 'token', identity: identity(1, 1) }
        : { agentToken: 'token', identity: identity(1, 2) };

    const edge = buildEdge(
      createRateLimitMiddleware({ now: () => 1_000_000, maxRequests: 1, windowMs: 60_000 }),
      authenticate,
    );

    const first = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);
    const sameUserOtherRendering = await request(edge)
      .get('/agent/v1/users/list')
      .set(BFF_KEY_HEADER, OTHER_KEY);

    expect(first.status).toBe(200);
    expect(sameUserOtherRendering.status).toBe(200);
  });

  it('isolates the oauth bucket from the api-key bucket even at identical ids', async () => {
    const edge = buildEdge(
      createRateLimitMiddleware({ now: () => 1_000_000, maxRequests: 1, windowMs: 60_000 }),
    );

    const viaKey = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);
    const viaKeyAgain = await request(edge)
      .get('/agent/v1/users/list')
      .set(BFF_KEY_HEADER, RAW_KEY);
    const viaBearer = await request(edge)
      .get('/agent/v1/users/list')
      .set('Authorization', `Bearer ${bearerToken()}`);

    expect(viaKey.status).toBe(200);
    expect(viaKeyAgain.status).toBe(429);
    expect(viaBearer.status).toBe(200);
  });

  it('opens a new window once the previous one has elapsed', async () => {
    let current = 1_000_000;
    const edge = buildEdge(
      createRateLimitMiddleware({ now: () => current, maxRequests: 1, windowMs: 60_000 }),
    );

    const first = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);
    const throttled = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);

    current += 60_001;

    const refreshed = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);

    expect(first.status).toBe(200);
    expect(throttled.status).toBe(429);
    expect(refreshed.status).toBe(200);
  });

  it('treats a request arriving exactly at the window boundary as a new window', async () => {
    let current = 1_000_000;
    const edge = buildEdge(
      createRateLimitMiddleware({ now: () => current, maxRequests: 1, windowMs: 60_000 }),
    );

    const first = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);

    current += 60_000;

    const atBoundary = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);

    expect(first.status).toBe(200);
    expect(atBoundary.status).toBe(200);
  });

  it('rounds the Retry-After up to at least one second', async () => {
    let current = 1_000_000;
    const edge = buildEdge(
      createRateLimitMiddleware({ now: () => current, maxRequests: 1, windowMs: 60_000 }),
    );

    await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);

    current += 59_999;

    const throttled = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);

    expect(throttled.status).toBe(429);
    expect(throttled.headers['retry-after']).toBe('1');
  });

  it('never throttles unauthenticated requests, which 401 before the limiter', async () => {
    const edge = buildEdge(
      createRateLimitMiddleware({ now: () => 1_000_000, maxRequests: 1, windowMs: 60_000 }),
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop -- order matters: each rejection must be observed before the next
      const response = await request(edge).get('/agent/v1/users/list');

      expect(response.status).toBe(401);
      expect(response.body.error).toMatchObject({ type: 'unauthorized', status: 401 });
    }
  });

  it('fails closed for a new identity when the bucket table is full', async () => {
    const authenticate: ApiKeyAuthenticator['authenticate'] = async rawKey =>
      rawKey === RAW_KEY
        ? { agentToken: 'token', identity: identity(1) }
        : { agentToken: 'token', identity: identity(2) };

    const edge = buildEdge(
      createRateLimitMiddleware({
        now: () => 1_000_000,
        maxRequests: 10,
        windowMs: 60_000,
        maxEntries: 1,
      }),
      authenticate,
    );

    const resident = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY);
    const overflow = await request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, OTHER_KEY);

    expect(resident.status).toBe(200);
    expect(overflow.status).toBe(429);
    expect(overflow.body.error).toMatchObject({ type: 'too_many_requests', status: 429 });
    expect(overflow.headers['retry-after']).toBe('60');
  });

  it('throttles concurrent bursts, not only sequential request chains', async () => {
    const edge = buildEdge(
      createRateLimitMiddleware({ now: () => 1_000_000, maxRequests: 3, windowMs: 60_000 }),
    );

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(edge).get('/agent/v1/users/list').set(BFF_KEY_HEADER, RAW_KEY),
      ),
    );

    const passed = responses.filter(response => response.status === 200);
    const throttled = responses.filter(response => response.status === 429);

    expect(passed).toHaveLength(3);
    expect(throttled).toHaveLength(7);
  });

  it('does not apply outside the agent paths', async () => {
    const edge = buildEdge(
      createRateLimitMiddleware({ now: () => 1_000_000, maxRequests: 1, windowMs: 60_000 }),
    );

    const first = await request(edge).get('/health').set(BFF_KEY_HEADER, RAW_KEY);
    const second = await request(edge).get('/health').set(BFF_KEY_HEADER, RAW_KEY);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});
