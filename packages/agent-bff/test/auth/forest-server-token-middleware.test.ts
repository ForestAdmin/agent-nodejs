import type { SessionStore } from '../../src/oauth/session-store';
import type { Context } from 'koa';

import createForestServerTokenMiddleware, {
  resolveForestServerToken,
} from '../../src/auth/forest-server-token-middleware';
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

function storeOf(saasAccessToken: string | undefined, get = jest.fn()) {
  const store = {
    get: get.mockImplementation((sid: string) =>
      sid === SESSION_ID && saasAccessToken !== undefined ? { saasAccessToken } : undefined,
    ),
  } as unknown as SessionStore;

  return { store, get };
}

async function landResolver(ctx: Context, store?: SessionStore): Promise<() => Promise<string>> {
  const middleware = createForestServerTokenMiddleware({
    session: store ? { store, serverClient: unusedServerClient } : undefined,
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

    it('should refuse with audit_unavailable when the resolution carried no token', async () => {
      const ctx = contextOf({ authMode: 'api-key', apiKeyIdentity: { renderingId: RENDERING_ID } });

      const resolve = await landResolver(ctx);

      await expect(resolve()).rejects.toMatchObject({
        status: 503,
        type: 'audit_unavailable',
        retryAfter: 5,
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
