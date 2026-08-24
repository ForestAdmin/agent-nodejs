import type AiProxyClient from '../../src/ai/ai-proxy-client';
import type { AiProxyResponse } from '../../src/ai/ai-proxy-client';
import type ForestServerClient from '../../src/oauth/forest-server-client';
import type { SessionStore, StoredSession } from '../../src/oauth/session-store';

import { bodyParser } from '@koa/bodyparser';
import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import { AiProxyTimeoutError } from '../../src/ai/ai-proxy-client';
import createAiRoutesMiddleware, { AI_QUERY_ROUTE } from '../../src/ai/ai-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';

const SAAS_ACCESS_TOKEN = 'saas-access-token';

function makeSessionStore(session?: Partial<StoredSession>): SessionStore {
  const stored = session && ({ saasAccessToken: SAAS_ACCESS_TOKEN, ...session } as StoredSession);

  return {
    get: jest.fn().mockReturnValue(stored),
    getSaasRefreshToken: jest.fn().mockReturnValue(undefined),
    updateSaasTokens: jest.fn(),
    create: jest.fn(),
    prepareRotation: jest.fn(),
    commitRotation: jest.fn(),
    destroy: jest.fn(),
    claimAuthorizationCode: jest.fn(),
    releaseAuthorizationCode: jest.fn(),
    pendingClaimCount: jest.fn(),
  };
}

function freshAccessToken(): string {
  return jsonwebtoken.sign({ scope: 'saas' }, 'irrelevant-for-decode', { expiresIn: '1h' });
}

interface AppOptions {
  query?: jest.Mock;
  store?: SessionStore;
  serverClient?: ForestServerClient;
  authMode?: 'oauth' | 'api-key';
  renderingId?: string;
  environmentId?: number;
}

function makeApp({
  query = jest.fn(),
  store,
  serverClient = {} as ForestServerClient,
  authMode = 'oauth',
  renderingId = '42',
  environmentId = 7,
}: AppOptions = {}) {
  const sessionStore = store ?? makeSessionStore({ saasAccessToken: freshAccessToken() });
  const app = new Koa();

  app.use(createErrorMiddleware({ logger: () => undefined }));
  app.use(bodyParser({ jsonLimit: '1mb', enableTypes: ['json'] }));
  app.use(async (ctx, next) => {
    ctx.state.authMode = authMode;

    if (authMode === 'oauth') {
      ctx.state.principal = { sid: 'session-id', rendering_id: renderingId };
    }

    await next();
  });
  app.use(
    createAiRoutesMiddleware({
      client: { query } as unknown as AiProxyClient,
      sessionStore,
      serverClient,
      environmentId,
      logger: () => undefined,
    }),
  );

  return { app, query, sessionStore };
}

function jsonResponse(status: number, body: unknown): AiProxyResponse {
  return { status, body, isJson: true };
}

describe('createAiRoutesMiddleware', () => {
  describe('when the path or method does not match', () => {
    it('should fall through without calling the upstream', async () => {
      const { app, query } = makeApp();

      await request(app.callback()).get(AI_QUERY_ROUTE).expect(404);

      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when the caller authenticated with an API key', () => {
    it('should refuse with 403 oauth_required and never reach the upstream', async () => {
      const { app, query } = makeApp({ authMode: 'api-key' });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(403);
      expect(response.body.error.type).toBe('oauth_required');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when the session is absent from the store', () => {
    it('should answer 401 session_expired without attempting a refresh', async () => {
      const store = makeSessionStore(undefined);
      const { app, query } = makeApp({ store });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(401);
      expect(response.body.error.type).toBe('session_expired');
      expect(store.getSaasRefreshToken).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when refreshing the session fails on a transient error', () => {
    it('should answer 502 network_error rather than the oauth server_error type', async () => {
      const store = makeSessionStore({ saasAccessToken: 'expired.token.value' });
      const serverClient = {
        refreshServerToken: jest.fn().mockRejectedValue(new Error('socket hang up')),
      } as unknown as ForestServerClient;
      (store.getSaasRefreshToken as jest.Mock).mockReturnValue('refresh-token');
      const query = jest.fn();
      const { app } = makeApp({ query, store, serverClient });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(502);
      expect(response.body.error.type).toBe('network_error');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when the session carries no usable rendering', () => {
    it('should answer 401 rather than send a bogus forest-rendering-id upstream', async () => {
      const { app, query } = makeApp({ renderingId: '0' });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(401);
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('when the session is valid', () => {
    it('should forward the session access token, not the incoming Authorization header', async () => {
      const saasAccessToken = freshAccessToken();
      const store = makeSessionStore({ saasAccessToken });
      const query = jest.fn().mockResolvedValue(jsonResponse(200, { choices: [] }));
      const { app } = makeApp({ query, store });

      await request(app.callback())
        .post(AI_QUERY_ROUTE)
        .set('Authorization', 'Bearer incoming-bff-access-token')
        .send({ messages: [] });

      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({ saasAccessToken, renderingId: 42, environmentId: 7 }),
      );
    });

    it('should relay the request body unchanged', async () => {
      const query = jest.fn().mockResolvedValue(jsonResponse(200, {}));
      const { app } = makeApp({ query });
      const body = { messages: [{ role: 'user', content: 'hi' }], tools: [] };

      await request(app.callback()).post(AI_QUERY_ROUTE).send(body);

      expect(query).toHaveBeenCalledWith(expect.objectContaining({ body }));
    });

    it('should relay the upstream 200 body unchanged', async () => {
      const upstream = { choices: [{ message: { content: 'answer' } }] };
      const query = jest.fn().mockResolvedValue(jsonResponse(200, upstream));
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(200);
      expect(response.body).toStrictEqual(upstream);
    });

    it('should relay a JSON 4xx with its status and body, so the upstream contract survives', async () => {
      const upstream = { errors: [{ detail: 'Missing required body parameter: messages' }] };
      const query = jest.fn().mockResolvedValue(jsonResponse(400, upstream));
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({});

      expect(response.status).toBe(400);
      expect(response.body).toStrictEqual(upstream);
    });
  });

  describe('when the upstream fails', () => {
    it('should keep a non-JSON 4xx status but replace its body, so no infrastructure HTML reaches the iframe', async () => {
      const query = jest.fn().mockResolvedValue({ status: 429, body: undefined, isJson: false });
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(429);
      expect(response.body.error.type).toBe('upstream_error');
      expect(response.type).toBe('application/json');
    });

    it('should keep a 5xx status but replace its body', async () => {
      const query = jest.fn().mockResolvedValue(jsonResponse(503, { internal: 'topology' }));
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('upstream_error');
      expect(JSON.stringify(response.body)).not.toContain('topology');
    });

    it('should answer 504 when the upstream times out', async () => {
      const query = jest.fn().mockRejectedValue(new AiProxyTimeoutError());
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(504);
      expect(response.body.error.type).toBe('upstream_timeout');
    });

    it('should answer 502 when the upstream is unreachable', async () => {
      const query = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:443'));
      const { app } = makeApp({ query });

      const response = await request(app.callback()).post(AI_QUERY_ROUTE).send({ messages: [] });

      expect(response.status).toBe(502);
      expect(JSON.stringify(response.body)).not.toContain('10.0.0.1');
    });
  });
});
