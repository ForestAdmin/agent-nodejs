import type ForestServerClient from '../../src/oauth/forest-server-client';
import type { ServerTokens } from '../../src/oauth/forest-server-client';
import type { SessionStore, StoredSession } from '../../src/oauth/session-store';

import jsonwebtoken from 'jsonwebtoken';

import { OAuthExchangeError } from '../../src/oauth/forest-server-client';
import ensureFreshServerAccess from '../../src/oauth/session-lifecycle';
import createInMemorySessionStore from '../../src/oauth/session-store';
import createTokenCipher from '../../src/oauth/token-cipher';

const KEY = Buffer.alloc(32, 8).toString('base64');

function accessToken(expSecondsFromNow: number): string {
  return jsonwebtoken.sign(
    { meta: { renderingId: 17 }, exp: Math.floor(Date.now() / 1000) + expSecondsFromNow },
    'irrelevant',
  );
}

function buildStore() {
  return createInMemorySessionStore({
    cipher: createTokenCipher(KEY),
    now: () => Date.now(),
    sessionTtlSeconds: 3600,
  });
}

function rotatedTokens(): ServerTokens {
  return {
    saasAccessToken: accessToken(3600),
    saasRefreshToken: 'NEW-REFRESH',
    renderingId: 17,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
}

describe('ensureFreshServerAccess', () => {
  const logger = jest.fn();

  beforeEach(() => {
    logger.mockReset();
  });

  describe('when the stored SaaS access token is still valid', () => {
    it('should return it without refreshing or writing to the store', async () => {
      const store = buildStore();
      const validAccess = accessToken(3600);
      const { sid } = store.create({
        saasAccessToken: validAccess,
        saasRefreshToken: 'R1',
        renderingId: 17,
        userId: 42,
        clientId: 'client-1',
      });
      const refreshServerToken = jest.fn();
      const client = { refreshServerToken } as unknown as ForestServerClient;

      const result = await ensureFreshServerAccess({ sid, store, serverClient: client, logger });

      expect(result).toBe(validAccess);
      expect(refreshServerToken).not.toHaveBeenCalled();
    });
  });

  describe('when the stored SaaS access token is expired', () => {
    it('should refresh, persist the rotated tokens, and return the new access', async () => {
      const store = buildStore();
      const { sid } = store.create({
        saasAccessToken: accessToken(-10),
        saasRefreshToken: 'R1',
        renderingId: 17,
        userId: 42,
        clientId: 'client-1',
      });
      const rotated = rotatedTokens();
      const client = {
        refreshServerToken: jest.fn(async () => rotated),
      } as unknown as ForestServerClient;

      const result = await ensureFreshServerAccess({ sid, store, serverClient: client, logger });

      expect(result).toBe(rotated.saasAccessToken);
      expect(store.get(sid)?.saasAccessToken).toBe(rotated.saasAccessToken);
      expect(store.getSaasRefreshToken(sid)).toBe('NEW-REFRESH');
    });

    it('should refresh with the client id stored at code exchange', async () => {
      const store = buildStore();
      const { sid } = store.create({
        saasAccessToken: accessToken(-10),
        saasRefreshToken: 'R1',
        renderingId: 17,
        userId: 42,
        clientId: 'client-1',
      });
      const refreshServerToken = jest.fn(async () => rotatedTokens());
      const client = { refreshServerToken } as unknown as ForestServerClient;

      await ensureFreshServerAccess({ sid, store, serverClient: client, logger });

      expect(refreshServerToken).toHaveBeenCalledWith({ refreshToken: 'R1', clientId: 'client-1' });
    });
  });

  describe('when the session has no stored client id', () => {
    it('should throw session_expired and log it, without calling the Forest server', async () => {
      const expiredAccess = accessToken(-10);
      const store: SessionStore = {
        get: () =>
          ({ saasAccessToken: expiredAccess, renderingId: 17, userId: 42 } as StoredSession),
        getSaasRefreshToken: () => 'R1',
        create: jest.fn(),
        updateSaasTokens: jest.fn(),
        claimAuthorizationCode: jest.fn(),
        releaseAuthorizationCode: jest.fn(),
        prepareRotation: jest.fn(),
        commitRotation: jest.fn(),
        destroy: jest.fn(),
        pendingClaimCount: jest.fn(),
      };
      const refreshServerToken = jest.fn();
      const client = { refreshServerToken } as unknown as ForestServerClient;

      await expect(
        ensureFreshServerAccess({ sid: 'sid-1', store, serverClient: client, logger }),
      ).rejects.toMatchObject({ type: 'session_expired' });
      expect(refreshServerToken).not.toHaveBeenCalled();
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'The session has no client id to refresh the Forest server token',
        { renderingId: 17, userId: 42 },
      );
    });
  });

  describe('when two concurrent requests hit an expired access token', () => {
    it('should refresh only once (single-flight per sid) and return the same new access to both', async () => {
      const store = buildStore();
      const { sid } = store.create({
        saasAccessToken: accessToken(-10),
        saasRefreshToken: 'R1',
        renderingId: 17,
        userId: 42,
        clientId: 'client-1',
      });
      const rotated = rotatedTokens();
      const refreshServerToken = jest.fn(async () => {
        await new Promise(resolve => {
          setTimeout(resolve, 10);
        });

        return rotated;
      });
      const client = { refreshServerToken } as unknown as ForestServerClient;

      const [a, b] = await Promise.all([
        ensureFreshServerAccess({ sid, store, serverClient: client, logger }),
        ensureFreshServerAccess({ sid, store, serverClient: client, logger }),
      ]);

      expect(refreshServerToken).toHaveBeenCalledTimes(1);
      expect(a).toBe(rotated.saasAccessToken);
      expect(b).toBe(rotated.saasAccessToken);
    });
  });

  describe('when the session does not exist', () => {
    it('should throw a session_expired error without refreshing', async () => {
      const store = buildStore();
      const refreshServerToken = jest.fn();
      const client = { refreshServerToken } as unknown as ForestServerClient;

      await expect(
        ensureFreshServerAccess({ sid: 'unknown-sid', store, serverClient: client, logger }),
      ).rejects.toMatchObject({ type: 'session_expired' });
      expect(refreshServerToken).not.toHaveBeenCalled();
    });
  });

  describe('when the session exists but its SaaS refresh token is gone', () => {
    it('should throw a session_expired error', async () => {
      const expiredAccess = accessToken(-10);
      const store: SessionStore = {
        get: () => ({ saasAccessToken: expiredAccess, clientId: 'client-1' } as StoredSession),
        getSaasRefreshToken: () => undefined,
        create: jest.fn(),
        updateSaasTokens: jest.fn(),
        claimAuthorizationCode: jest.fn(),
        releaseAuthorizationCode: jest.fn(),
        prepareRotation: jest.fn(),
        commitRotation: jest.fn(),
        destroy: jest.fn(),
        pendingClaimCount: jest.fn(),
      };
      const refreshServerToken = jest.fn();
      const client = { refreshServerToken } as unknown as ForestServerClient;

      await expect(
        ensureFreshServerAccess({ sid: 'sid-1', store, serverClient: client, logger }),
      ).rejects.toMatchObject({ type: 'session_expired' });
      expect(refreshServerToken).not.toHaveBeenCalled();
    });
  });

  describe('when the session disappears during the refresh', () => {
    it('should throw session_expired instead of persisting into a gone session', async () => {
      const expiredAccess = accessToken(-10);
      const get = jest
        .fn()
        .mockReturnValueOnce({
          saasAccessToken: expiredAccess,
          clientId: 'client-1',
        } as StoredSession)
        .mockReturnValue(undefined);
      const updateSaasTokens = jest.fn();
      const store: SessionStore = {
        get,
        getSaasRefreshToken: () => 'R1',
        create: jest.fn(),
        updateSaasTokens,
        claimAuthorizationCode: jest.fn(),
        releaseAuthorizationCode: jest.fn(),
        prepareRotation: jest.fn(),
        commitRotation: jest.fn(),
        destroy: jest.fn(),
        pendingClaimCount: jest.fn(),
      };
      const client = {
        refreshServerToken: jest.fn(async () => rotatedTokens()),
      } as unknown as ForestServerClient;

      await expect(
        ensureFreshServerAccess({ sid: 'sid-1', store, serverClient: client, logger }),
      ).rejects.toMatchObject({ type: 'session_expired' });
      expect(updateSaasTokens).not.toHaveBeenCalled();
    });
  });

  describe('when the underlying SaaS refresh fails transiently', () => {
    it('should throw a server_error (not session_expired) so the client can retry', async () => {
      const store = buildStore();
      const { sid } = store.create({
        saasAccessToken: accessToken(-10),
        saasRefreshToken: 'R1',
        renderingId: 17,
        userId: 42,
        clientId: 'client-1',
      });
      const client = {
        refreshServerToken: jest.fn(async () => {
          throw new Error('saas down');
        }),
      } as unknown as ForestServerClient;

      await expect(
        ensureFreshServerAccess({ sid, store, serverClient: client, logger }),
      ).rejects.toMatchObject({ type: 'server_error' });
    });
  });

  describe('when the Forest server rejects the refresh token', () => {
    it('should throw session_expired so the client re-authenticates', async () => {
      const store = buildStore();
      const { sid } = store.create({
        saasAccessToken: accessToken(-10),
        saasRefreshToken: 'R1',
        renderingId: 17,
        userId: 42,
        clientId: 'client-1',
      });
      const client = {
        refreshServerToken: jest.fn(async () => {
          throw new OAuthExchangeError('invalid_grant', 'refresh token revoked');
        }),
      } as unknown as ForestServerClient;

      await expect(
        ensureFreshServerAccess({ sid, store, serverClient: client, logger }),
      ).rejects.toMatchObject({ type: 'session_expired' });
    });

    it('should log the error code and description the Forest server sent', async () => {
      const store = buildStore();
      const { sid } = store.create({
        saasAccessToken: accessToken(-10),
        saasRefreshToken: 'R1',
        renderingId: 17,
        userId: 42,
        clientId: 'client-1',
      });
      const client = {
        refreshServerToken: jest.fn(async () => {
          throw new OAuthExchangeError('invalid_request', '"client_id" is required');
        }),
      } as unknown as ForestServerClient;

      await expect(
        ensureFreshServerAccess({ sid, store, serverClient: client, logger }),
      ).rejects.toMatchObject({ type: 'session_expired' });
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'The Forest server rejected the session refresh',
        {
          renderingId: 17,
          userId: 42,
          error: 'invalid_request',
          errorDescription: '"client_id" is required',
        },
      );
    });
  });
});
