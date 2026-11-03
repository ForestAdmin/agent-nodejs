import type { SessionTokenCodec } from '../../src/oauth/session-token';
import type { Logger } from '../../src/ports/logger-port';
import type { Context } from 'koa';

import jsonwebtoken from 'jsonwebtoken';

import createForestServerTokenMiddleware, {
  resolveForestServerToken,
} from '../../src/auth/forest-server-token-middleware';
import {
  API_KEY_SERVER_TOKEN,
  RENDERING_ID,
  SESSION_ID,
  SESSION_USER_ID,
  sealedServerAccess,
  sessionAccessToken,
  testSessionTokens,
} from '../helpers/activity-log';

function contextOf(state: Record<string, unknown>): Context {
  return { state } as unknown as Context;
}

function expiredAccessToken(): string {
  return jsonwebtoken.sign({ scope: 'forest' }, 'session-secret', { expiresIn: '-1s' });
}

function oauthContext(serverAccess: string | undefined): Context {
  return contextOf({
    authMode: 'oauth',
    principal: {
      sid: SESSION_ID,
      id: SESSION_USER_ID,
      rendering_id: String(RENDERING_ID),
      server_access: serverAccess,
    },
  });
}

async function landResolver(
  ctx: Context,
  sessionTokens?: SessionTokenCodec,
  logger: Logger = () => undefined,
): Promise<() => Promise<string>> {
  const middleware = createForestServerTokenMiddleware({
    session: sessionTokens ? { sessionTokens } : undefined,
    logger,
  });

  await middleware(ctx, async () => undefined);

  return () => resolveForestServerToken(ctx);
}

function spiedSessionTokens(): { sessionTokens: SessionTokenCodec; openServerAccess: jest.Mock } {
  const openServerAccess = jest.fn(testSessionTokens.openServerAccess);

  return { sessionTokens: { ...testSessionTokens, openServerAccess }, openServerAccess };
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
    it('should resolve the Forest server access sealed in the session token', async () => {
      const saasAccessToken = sessionAccessToken();
      const ctx = oauthContext(sealedServerAccess(saasAccessToken));

      const resolve = await landResolver(ctx, testSessionTokens);

      await expect(resolve()).resolves.toBe(saasAccessToken);
    });

    it('should refuse with session_expired when the token carries no server access', async () => {
      const ctx = oauthContext(undefined);

      const resolve = await landResolver(ctx, testSessionTokens);

      await expect(resolve()).rejects.toMatchObject({ status: 401, type: 'session_expired' });
    });

    it('should refuse with session_expired and report why when the sealed access is unreadable', async () => {
      const logger = jest.fn();
      const ctx = oauthContext('not-a-sealed-value');

      const resolve = await landResolver(ctx, testSessionTokens, logger);

      await expect(resolve()).rejects.toMatchObject({ status: 401, type: 'session_expired' });
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Could not resolve the Forest server access of this session',
        { renderingId: RENDERING_ID, cause: 'Session not found or expired' },
      );
    });

    it('should refuse with session_expired when the sealed Forest server access expired', async () => {
      const ctx = oauthContext(sealedServerAccess(expiredAccessToken()));

      const resolve = await landResolver(ctx, testSessionTokens);

      await expect(resolve()).rejects.toMatchObject({ status: 401, type: 'session_expired' });
    });

    it('should refuse with session_expired when the deployment carries no OAuth session', async () => {
      const ctx = oauthContext(sealedServerAccess(sessionAccessToken()));

      const resolve = await landResolver(ctx);

      await expect(resolve()).rejects.toMatchObject({ status: 401, type: 'session_expired' });
    });

    it('should open the sealed access only once for repeated resolutions', async () => {
      const { sessionTokens, openServerAccess } = spiedSessionTokens();
      const sealed = sealedServerAccess(sessionAccessToken());
      const ctx = oauthContext(sealed);

      const resolve = await landResolver(ctx, sessionTokens);
      await resolve();
      await resolve();

      expect(openServerAccess).toHaveBeenCalledTimes(1);
      expect(openServerAccess).toHaveBeenCalledWith(sealed, {
        sid: SESSION_ID,
        userId: SESSION_USER_ID,
        renderingId: RENDERING_ID,
      });
    });
  });

  it('should not open the sealed access when nothing resolves the token', async () => {
    const { sessionTokens, openServerAccess } = spiedSessionTokens();

    await landResolver(oauthContext(sealedServerAccess(sessionAccessToken())), sessionTokens);

    expect(openServerAccess).not.toHaveBeenCalled();
  });

  it('should refuse with session_expired when no resolver was landed on the context', () => {
    expect(() => resolveForestServerToken(contextOf({ authMode: 'oauth' }))).toThrow(
      expect.objectContaining({ status: 401, type: 'session_expired' }),
    );
  });
});
