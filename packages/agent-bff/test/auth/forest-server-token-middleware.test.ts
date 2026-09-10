import type ForestServerClient from '../../src/oauth/forest-server-client';
import type { SessionStore } from '../../src/oauth/session-store';
import type { Logger } from '../../src/ports/logger-port';
import type { Context } from 'koa';

import jsonwebtoken from 'jsonwebtoken';

import createForestServerTokenMiddleware, {
  resolveForestServerToken,
} from '../../src/auth/forest-server-token-middleware';
import OAuthExchangeError from '../../src/oauth/oauth-exchange-error';
import {
  API_KEY_SERVER_TOKEN,
  RENDERING_ID,
  SESSION_ID,
  sessionAccessToken,
  unusedServerClient,
} from '../helpers/activity-log';

function contextOf(state: Record<string, unknown>): Context {
  return { state } as unknown as Context;
}

function expiredAccessToken(): string {
  return jsonwebtoken.sign({ scope: 'forest' }, 'session-secret', { expiresIn: '-1s' });
}

function storeOf(saasAccessToken: string | undefined, get = jest.fn()) {
  const store = {
    get: get.mockImplementation((sid: string) =>
      sid === SESSION_ID && saasAccessToken !== undefined ? { saasAccessToken } : undefined,
    ),
  } as unknown as SessionStore;

  return { store, get };
}

async function landResolver(
  ctx: Context,
  store?: SessionStore,
  logger: Logger = () => undefined,
): Promise<() => Promise<string>> {
  const middleware = createForestServerTokenMiddleware({
    session: store ? { store, serverClient: unusedServerClient } : undefined,
    logger,
  });

  await middleware(ctx, async () => undefined);

  return () => resolveForestServerToken(ctx);
}

describe('forest server token middleware', () => {
  describe('in api-key mode', () => {
    it('should resolve the token the key resolution carried', async () => {
      const ctx = contextOf({
        authMode: 'api-key',
        apiKeyIdentity: { renderingId: RENDERING_ID },
        forestServerToken: API_KEY_SERVER_TOKEN,
      });

      const resolve = await landResolver(ctx);

      await expect(resolve()).resolves.toBe(API_KEY_SERVER_TOKEN);
    });

    it('should refuse without advertising a retry when the resolution carried no token', async () => {
      const ctx = contextOf({ authMode: 'api-key', apiKeyIdentity: { renderingId: RENDERING_ID } });

      const resolve = await landResolver(ctx);

      await expect(resolve()).rejects.toMatchObject({
        status: 503,
        type: 'audit_unavailable',
        retryAfter: undefined,
        message:
          'The Forest server does not provide the credential the activity log is written with, ' +
          'so the operation was not performed',
      });
    });
  });

  describe('in oauth mode', () => {
    it('should resolve the token held by the session', async () => {
      const saasAccessToken = sessionAccessToken();
      const { store } = storeOf(saasAccessToken);
      const ctx = contextOf({
        authMode: 'oauth',
        principal: { sid: SESSION_ID, rendering_id: String(RENDERING_ID) },
      });

      const resolve = await landResolver(ctx, store);

      await expect(resolve()).resolves.toBe(saasAccessToken);
    });

    it('should refuse with session_expired when the session is gone', async () => {
      const { store } = storeOf(undefined);
      const ctx = contextOf({
        authMode: 'oauth',
        principal: { sid: SESSION_ID, rendering_id: String(RENDERING_ID) },
      });

      const resolve = await landResolver(ctx, store);

      await expect(resolve()).rejects.toMatchObject({
        status: 401,
        type: 'session_expired',
      });
    });

    it('should refuse with audit_unavailable when the Forest server cannot be reached', async () => {
      const store = {
        get: () => ({ saasAccessToken: expiredAccessToken() }),
        getSaasRefreshToken: () => 'refresh-token',
      } as unknown as SessionStore;
      const serverClient = {
        refreshServerToken: async () => {
          throw new Error('connect ECONNREFUSED');
        },
      } as unknown as ForestServerClient;
      const ctx = contextOf({
        authMode: 'oauth',
        principal: { sid: SESSION_ID, rendering_id: String(RENDERING_ID) },
      });

      const middleware = createForestServerTokenMiddleware({
        session: { store, serverClient },
        logger: () => undefined,
      });
      await middleware(ctx, async () => undefined);

      await expect(resolveForestServerToken(ctx)).rejects.toMatchObject({
        status: 503,
        type: 'audit_unavailable',
      });
    });

    it('should report the original failure, which the mapped error drops', async () => {
      const store = {
        get: () => {
          throw new TypeError('sessions.get is not a function');
        },
      } as unknown as SessionStore;
      const logger = jest.fn();
      const ctx = contextOf({
        authMode: 'oauth',
        principal: { sid: SESSION_ID, rendering_id: String(RENDERING_ID) },
      });

      const resolve = await landResolver(ctx, store, logger);

      await expect(resolve()).rejects.toMatchObject({ status: 503, type: 'audit_unavailable' });
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'Could not resolve the Forest server access of this session',
        { renderingId: RENDERING_ID, cause: 'sessions.get is not a function' },
      );
    });

    it('should refuse with session_expired when the Forest server rejects the refresh token', async () => {
      const store = {
        get: () => ({ saasAccessToken: expiredAccessToken() }),
        getSaasRefreshToken: () => 'refresh-token',
      } as unknown as SessionStore;
      const serverClient = {
        refreshServerToken: async () => {
          throw new OAuthExchangeError('invalid_grant', 'the refresh token was revoked');
        },
      } as unknown as ForestServerClient;
      const ctx = contextOf({
        authMode: 'oauth',
        principal: { sid: SESSION_ID, rendering_id: String(RENDERING_ID) },
      });

      const logger = jest.fn();
      const middleware = createForestServerTokenMiddleware({
        session: { store, serverClient },
        logger,
      });
      await middleware(ctx, async () => undefined);

      await expect(resolveForestServerToken(ctx)).rejects.toMatchObject({
        status: 401,
        type: 'session_expired',
      });
      expect(logger).toHaveBeenCalledWith(
        'Error',
        'Could not resolve the Forest server access of this session',
        { renderingId: RENDERING_ID, cause: 'The Forest server rejected the refresh token' },
      );
    });

    it('should refuse with session_expired when the deployment carries no session store', async () => {
      const ctx = contextOf({
        authMode: 'oauth',
        principal: { sid: SESSION_ID, rendering_id: String(RENDERING_ID) },
      });

      const resolve = await landResolver(ctx);

      await expect(resolve()).rejects.toMatchObject({
        status: 401,
        type: 'session_expired',
      });
    });

    it('should look the session up only once for repeated resolutions', async () => {
      const { store, get } = storeOf(sessionAccessToken());
      const ctx = contextOf({
        authMode: 'oauth',
        principal: { sid: SESSION_ID, rendering_id: String(RENDERING_ID) },
      });

      const resolve = await landResolver(ctx, store);
      await resolve();
      await resolve();

      expect(get).toHaveBeenCalledTimes(1);
    });
  });

  it('should not look the session up when nothing resolves the token', async () => {
    const { store, get } = storeOf(sessionAccessToken());
    const ctx = contextOf({
      authMode: 'oauth',
      principal: { sid: SESSION_ID, rendering_id: String(RENDERING_ID) },
    });

    await landResolver(ctx, store);

    expect(get).not.toHaveBeenCalled();
  });

  it('should refuse with session_expired when no resolver was landed on the context', () => {
    expect(() => resolveForestServerToken(contextOf({ authMode: 'oauth' }))).toThrow(
      expect.objectContaining({ status: 401, type: 'session_expired' }),
    );
  });
});
