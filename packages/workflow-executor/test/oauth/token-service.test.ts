import type CredentialEncryption from '../../src/crypto/credential-encryption';
import type { RefreshGrantParams, RefreshGrantResult } from '../../src/oauth/refresh-grant';
import type {
  McpOAuthCredentialInput,
  McpOAuthCredentialsStore,
  StoredMcpOAuthCredential,
} from '../../src/ports/mcp-oauth-credentials-store';

import {
  ExecutorEncryptionKeyMissingError,
  OAuthInvalidGrantError,
  OAuthReauthRequiredError,
  OAuthRefreshError,
} from '../../src/errors';
import OAuthTokenService from '../../src/oauth/token-service';

const USER_ID = 7;
const SERVER_ID = 'srv-1';

function makeCredential(
  overrides: Partial<StoredMcpOAuthCredential> = {},
): StoredMcpOAuthCredential {
  return {
    id: 1,
    userId: USER_ID,
    mcpServerId: SERVER_ID,
    refreshTokenEnc: Buffer.from('enc-rt-1'),
    clientId: 'cid',
    clientSecretEnc: Buffer.from('enc-secret'),
    clientSecretExpiresAt: null,
    tokenEndpoint: 'https://idp/token',
    tokenEndpointAuthMethod: 'client_secret_basic',
    scopes: 'a b',
    ...overrides,
  };
}

function setup(options?: {
  credential?: StoredMcpOAuthCredential | null;
  refresh?: jest.Mock<Promise<RefreshGrantResult>, [RefreshGrantParams]>;
  expirySkewS?: number;
}) {
  const credential = options?.credential === undefined ? makeCredential() : options.credential;
  const get = jest.fn().mockResolvedValue(credential);
  const upsert = jest.fn().mockResolvedValue(undefined);
  const updateIfPresent = jest.fn().mockResolvedValue(undefined);
  const store = { get, upsert, updateIfPresent } as unknown as McpOAuthCredentialsStore;

  const decrypt = jest.fn((buf: Buffer) => `decrypted:${buf.toString()}`);
  const encrypt = jest.fn((plain: string) => ({
    ciphertext: Buffer.from(`enc:${plain}`),
  }));
  const encryption = { decrypt, encrypt } as unknown as CredentialEncryption;

  const refresh =
    options?.refresh ?? jest.fn().mockResolvedValue({ accessToken: 'at-1', expiresInS: 3600 });

  let clock = 1_000_000;
  const now = () => clock;

  const service = new OAuthTokenService({
    store,
    encryption,
    refreshAccessToken: refresh,
    expirySkewS: options?.expirySkewS ?? 60,
    now,
  });

  return {
    service,
    get,
    upsert,
    updateIfPresent,
    decrypt,
    encrypt,
    refresh,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('OAuthTokenService.getAccessToken', () => {
  describe('acquisition', () => {
    it('looks up the credential by user and server, refreshes, and returns the access token', async () => {
      const { service, get, refresh } = setup();

      const token = await service.getAccessToken(USER_ID, SERVER_ID);

      expect(token).toBe('at-1');
      expect(get).toHaveBeenCalledWith(USER_ID, SERVER_ID);
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('decrypts the refresh token and client secret and passes the stored endpoint to the grant', async () => {
      const { service, refresh } = setup();

      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(refresh).toHaveBeenCalledWith({
        tokenEndpoint: 'https://idp/token',
        refreshToken: 'decrypted:enc-rt-1',
        clientId: 'cid',
        clientSecret: 'decrypted:enc-secret',
        tokenEndpointAuthMethod: 'client_secret_basic',
        scopes: 'a b',
      });
    });

    it('passes a null client secret to the grant when none is stored', async () => {
      const { service, refresh } = setup({ credential: makeCredential({ clientSecretEnc: null }) });

      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(refresh).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: null }));
    });

    it('raises OAuthReauthRequiredError and never refreshes when no credential is stored', async () => {
      const { service, refresh } = setup({ credential: null });

      await expect(service.getAccessToken(USER_ID, SERVER_ID)).rejects.toBeInstanceOf(
        OAuthReauthRequiredError,
      );
      expect(refresh).not.toHaveBeenCalled();
    });

    it('propagates a transient refresh failure without converting it to a re-auth pause', async () => {
      const refresh = jest.fn().mockRejectedValue(new OAuthRefreshError('5xx'));
      const { service } = setup({ refresh });

      await expect(service.getAccessToken(USER_ID, SERVER_ID)).rejects.toBeInstanceOf(
        OAuthRefreshError,
      );
    });
  });

  describe('expiry-skew cache', () => {
    it('serves the cached token on a second call within the skew window', async () => {
      const { service, refresh } = setup();

      const first = await service.getAccessToken(USER_ID, SERVER_ID);
      const second = await service.getAccessToken(USER_ID, SERVER_ID);

      expect(first).toBe(second);
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('evict drops the cached token so the next acquire refreshes again', async () => {
      const { service, refresh } = setup();

      await service.getAccessToken(USER_ID, SERVER_ID);
      await service.getAccessToken(USER_ID, SERVER_ID);
      expect(refresh).toHaveBeenCalledTimes(1); // second call served from cache

      service.evict(USER_ID, SERVER_ID);
      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(refresh).toHaveBeenCalledTimes(2); // cache dropped → refreshed again
    });

    it('refreshes again once the token is within the skew window of expiry', async () => {
      const { service, refresh, advance } = setup({ expirySkewS: 60 });

      await service.getAccessToken(USER_ID, SERVER_ID); // expires_in 3600s, skew 60s
      advance((3600 - 60) * 1000); // now exactly at the skew threshold

      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('does not cache a token when the grant omits expires_in', async () => {
      const refresh = jest.fn().mockResolvedValue({ accessToken: 'at-1' });
      const { service } = setup({ refresh });

      await service.getAccessToken(USER_ID, SERVER_ID);
      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('forceRefresh bypasses a still-valid cached token', async () => {
      const { service, refresh } = setup();

      await service.getAccessToken(USER_ID, SERVER_ID);
      await service.getAccessToken(USER_ID, SERVER_ID, { forceRefresh: true });

      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('caches independently per (user, server)', async () => {
      const { service, refresh } = setup();

      await service.getAccessToken(USER_ID, SERVER_ID);
      await service.getAccessToken(USER_ID, 'other-server');

      expect(refresh).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh-token rotation', () => {
    it('persists the rotated refresh token, encrypted, when the grant returns a new one', async () => {
      const refresh = jest
        .fn()
        .mockResolvedValue({ accessToken: 'at-1', expiresInS: 3600, refreshToken: 'rt-2' });
      const { service, updateIfPresent, encrypt } = setup({ refresh });

      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(encrypt).toHaveBeenCalledWith('rt-2');
      expect(updateIfPresent).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          userId: USER_ID,
          mcpServerId: SERVER_ID,
          refreshTokenEnc: Buffer.from('enc:rt-2'),
        }),
      );
    });

    it('does not write back when the grant returns no new refresh token', async () => {
      const { service, updateIfPresent } = setup();

      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(updateIfPresent).not.toHaveBeenCalled();
    });

    it('still returns the token when the rotation write-back fails', async () => {
      const refresh = jest
        .fn()
        .mockResolvedValue({ accessToken: 'at-1', expiresInS: 3600, refreshToken: 'rt-2' });
      const { service, updateIfPresent } = setup({ refresh });
      (updateIfPresent as jest.Mock).mockRejectedValue(new Error('db down'));

      await expect(service.getAccessToken(USER_ID, SERVER_ID)).resolves.toBe('at-1');
    });

    it('still returns the token when encrypting the rotated refresh token throws', async () => {
      const refresh = jest
        .fn()
        .mockResolvedValue({ accessToken: 'at-1', expiresInS: 3600, refreshToken: 'rt-2' });
      const { service, encrypt, updateIfPresent } = setup({ refresh });
      (encrypt as jest.Mock).mockImplementation(() => {
        throw new Error('key unavailable');
      });

      await expect(service.getAccessToken(USER_ID, SERVER_ID)).resolves.toBe('at-1');
      expect(updateIfPresent).not.toHaveBeenCalled();
    });
  });

  describe('invalid_grant — concurrent rotation recovery', () => {
    it('re-reads the credential and retries once with the rotated token', async () => {
      const rotated = makeCredential({ refreshTokenEnc: Buffer.from('enc-rt-rotated') });
      const get = jest.fn().mockResolvedValueOnce(makeCredential()).mockResolvedValueOnce(rotated);
      const refresh = jest
        .fn()
        .mockRejectedValueOnce(new OAuthInvalidGrantError())
        .mockResolvedValueOnce({ accessToken: 'at-after-retry', expiresInS: 3600 });

      const service = new OAuthTokenService({
        store: { get, upsert: jest.fn() } as unknown as McpOAuthCredentialsStore,
        encryption: {
          decrypt: (buf: Buffer) => `decrypted:${buf.toString()}`,
          encrypt: jest.fn(),
        } as unknown as CredentialEncryption,
        refreshAccessToken: refresh,
      });

      const token = await service.getAccessToken(USER_ID, SERVER_ID);

      expect(token).toBe('at-after-retry');
      expect(refresh).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ refreshToken: 'decrypted:enc-rt-rotated' }),
      );
    });

    it('persists the rotated token onto the re-read credential fields, not the stale ones', async () => {
      const original = makeCredential({ scopes: 'a b' });
      const latest = makeCredential({
        refreshTokenEnc: Buffer.from('enc-rt-rotated'),
        scopes: 'a b c',
      });
      const get = jest.fn().mockResolvedValueOnce(original).mockResolvedValueOnce(latest);
      const updateIfPresent = jest.fn().mockResolvedValue(undefined);
      const refresh = jest
        .fn()
        .mockRejectedValueOnce(new OAuthInvalidGrantError())
        .mockResolvedValueOnce({ accessToken: 'at', expiresInS: 3600, refreshToken: 'rt-3' });

      const service = new OAuthTokenService({
        store: { get, upsert: jest.fn(), updateIfPresent } as unknown as McpOAuthCredentialsStore,
        encryption: {
          decrypt: (buf: Buffer) => buf.toString(),
          encrypt: () => ({ ciphertext: Buffer.from('enc:rt-3') }),
        } as unknown as CredentialEncryption,
        refreshAccessToken: refresh,
      });

      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(updateIfPresent).toHaveBeenCalledWith(1, expect.objectContaining({ scopes: 'a b c' }));
    });

    it('raises OAuthReauthRequiredError when the re-read shows the same (unrotated) token', async () => {
      const refresh = jest.fn().mockRejectedValue(new OAuthInvalidGrantError());
      const { service } = setup({ refresh });

      await expect(service.getAccessToken(USER_ID, SERVER_ID)).rejects.toBeInstanceOf(
        OAuthReauthRequiredError,
      );
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('raises OAuthReauthRequiredError when the retry also returns invalid_grant', async () => {
      const rotated = makeCredential({ refreshTokenEnc: Buffer.from('enc-rt-rotated') });
      const get = jest.fn().mockResolvedValueOnce(makeCredential()).mockResolvedValueOnce(rotated);
      const refresh = jest.fn().mockRejectedValue(new OAuthInvalidGrantError());

      const service = new OAuthTokenService({
        store: { get, upsert: jest.fn() } as unknown as McpOAuthCredentialsStore,
        encryption: {
          decrypt: (buf: Buffer) => buf.toString(),
          encrypt: jest.fn(),
        } as unknown as CredentialEncryption,
        refreshAccessToken: refresh,
      });

      await expect(service.getAccessToken(USER_ID, SERVER_ID)).rejects.toBeInstanceOf(
        OAuthReauthRequiredError,
      );
      expect(refresh).toHaveBeenCalledTimes(2);
    });
  });

  describe('serialization', () => {
    it('collapses concurrent requests for the same (user, server) into a single refresh', async () => {
      let resolveRefresh!: (value: RefreshGrantResult) => void;
      const refresh = jest.fn().mockReturnValue(
        new Promise<RefreshGrantResult>(resolve => {
          resolveRefresh = resolve;
        }),
      );
      const { service } = setup({ refresh });

      const a = service.getAccessToken(USER_ID, SERVER_ID);
      const b = service.getAccessToken(USER_ID, SERVER_ID);
      resolveRefresh({ accessToken: 'at-shared', expiresInS: 3600 });

      await expect(a).resolves.toBe('at-shared');
      await expect(b).resolves.toBe('at-shared');
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('decrypt failure classification', () => {
    it('surfaces a decrypt failure with the key present as needs-oauth-reauth (recoverable)', async () => {
      const service = new OAuthTokenService({
        store: {
          get: jest.fn().mockResolvedValue(makeCredential()),
          upsert: jest.fn(),
        } as unknown as McpOAuthCredentialsStore,
        encryption: {
          // A since-rotated/hard-swapped key fails GCM auth-tag verification with a generic error.
          decrypt: () => {
            throw new Error('Unsupported state or unable to authenticate data');
          },
          encrypt: jest.fn(),
        } as unknown as CredentialEncryption,
        refreshAccessToken: jest.fn(),
      });

      await expect(service.getAccessToken(USER_ID, SERVER_ID)).rejects.toBeInstanceOf(
        OAuthReauthRequiredError,
      );
    });

    it('rethrows a missing-key error as terminal, never reaching the grant', async () => {
      const refreshAccessToken = jest.fn();
      const service = new OAuthTokenService({
        store: {
          get: jest.fn().mockResolvedValue(makeCredential()),
          upsert: jest.fn(),
        } as unknown as McpOAuthCredentialsStore,
        encryption: {
          decrypt: () => {
            throw new ExecutorEncryptionKeyMissingError();
          },
          encrypt: jest.fn(),
        } as unknown as CredentialEncryption,
        refreshAccessToken,
      });

      await expect(service.getAccessToken(USER_ID, SERVER_ID)).rejects.toBeInstanceOf(
        ExecutorEncryptionKeyMissingError,
      );
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });
});

// A disconnect (DELETE) landing between the grant read and the write-back must not re-create the
// row: the atomic update-only path leaves a deleted credential deleted, not silently resurrected.
describe('OAuthTokenService — concurrent disconnect during refresh write-back', () => {
  it('does not resurrect a credential deleted between the snapshot read and the rotated-token write-back', async () => {
    // GIVEN a stored credential and a refresh that rotates the token while a concurrent disconnect
    // (the row is DELETED) lands before the write-back; updateIfPresent updates only an existing row.
    let current: StoredMcpOAuthCredential | null = makeCredential();
    const store = {
      get: jest.fn(async () => current),
      updateIfPresent: jest.fn(async (id: number, credential: McpOAuthCredentialInput) => {
        if (current && current.id === id) current = { ...credential, id };
      }),
      delete: jest.fn(async () => {
        current = null;
      }),
    } as unknown as McpOAuthCredentialsStore;

    const refresh = jest.fn(async () => {
      // The disconnect lands after refreshAndCache's snapshot read, before persistRotatedRefreshToken.
      await store.delete(USER_ID, SERVER_ID);

      return { accessToken: 'at-1', expiresInS: 3600, refreshToken: 'rotated-rt' };
    });

    const encryption = {
      decrypt: (buf: Buffer) => buf.toString(),
      encrypt: (plain: string) => ({ ciphertext: Buffer.from(`enc:${plain}`) }),
    } as unknown as CredentialEncryption;

    const service = new OAuthTokenService({ store, encryption, refreshAccessToken: refresh });

    // WHEN a token is acquired, triggering the refresh and the rotated-token write-back.
    await service.getAccessToken(USER_ID, SERVER_ID);

    // THEN the deleted credential must stay deleted — the write-back must not recreate it.
    expect(await store.get(USER_ID, SERVER_ID)).toBeNull();
  });
});

// A refresh already in flight when evict() fires (disconnect) must not repopulate the cache
// afterwards, or later calls keep serving a token for a disconnected credential.
describe('OAuthTokenService — evict during in-flight refresh', () => {
  it('does not cache the freshly-minted token when a disconnect evicts mid-refresh', async () => {
    const refresh = jest.fn().mockResolvedValue({ accessToken: 'at-2', expiresInS: 3600 });
    const { service } = setup({ refresh });
    // The disconnect (evict) lands during the first refresh — after the snapshot read, before caching.
    refresh.mockImplementationOnce(async () => {
      service.evict(USER_ID, SERVER_ID);

      return { accessToken: 'at-1', expiresInS: 3600 };
    });

    const first = await service.getAccessToken(USER_ID, SERVER_ID);
    const second = await service.getAccessToken(USER_ID, SERVER_ID);

    // The in-flight caller still gets its token, but it was not cached — the next call refreshes anew.
    expect(first).toBe('at-1');
    expect(second).toBe('at-2');
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
