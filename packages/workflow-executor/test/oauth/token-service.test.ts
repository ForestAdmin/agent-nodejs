import type CredentialEncryption from '../../src/crypto/credential-encryption';
import type { RefreshGrantParams, RefreshGrantResult } from '../../src/oauth/refresh-grant';
import type {
  McpOAuthCredentialsStore,
  StoredMcpOAuthCredential,
} from '../../src/ports/mcp-oauth-credentials-store';

import {
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
    encKeyVersion: 1,
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
  const store = { get, upsert } as unknown as McpOAuthCredentialsStore;

  const decrypt = jest.fn((buf: Buffer) => `decrypted:${buf.toString()}`);
  const encrypt = jest.fn((plain: string) => ({
    ciphertext: Buffer.from(`enc:${plain}`),
    encKeyVersion: 2,
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
      const { service, upsert, encrypt } = setup({ refresh });

      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(encrypt).toHaveBeenCalledWith('rt-2');
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          mcpServerId: SERVER_ID,
          refreshTokenEnc: Buffer.from('enc:rt-2'),
          encKeyVersion: 2,
        }),
      );
    });

    it('does not write back when the grant returns no new refresh token', async () => {
      const { service, upsert } = setup();

      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(upsert).not.toHaveBeenCalled();
    });

    it('still returns the token when the rotation write-back fails', async () => {
      const refresh = jest
        .fn()
        .mockResolvedValue({ accessToken: 'at-1', expiresInS: 3600, refreshToken: 'rt-2' });
      const { service, upsert } = setup({ refresh });
      (upsert as jest.Mock).mockRejectedValue(new Error('db down'));

      await expect(service.getAccessToken(USER_ID, SERVER_ID)).resolves.toBe('at-1');
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
      const upsert = jest.fn().mockResolvedValue(undefined);
      const refresh = jest
        .fn()
        .mockRejectedValueOnce(new OAuthInvalidGrantError())
        .mockResolvedValueOnce({ accessToken: 'at', expiresInS: 3600, refreshToken: 'rt-3' });

      const service = new OAuthTokenService({
        store: { get, upsert } as unknown as McpOAuthCredentialsStore,
        encryption: {
          decrypt: (buf: Buffer) => buf.toString(),
          encrypt: () => ({ ciphertext: Buffer.from('enc:rt-3'), encKeyVersion: 2 }),
        } as unknown as CredentialEncryption,
        refreshAccessToken: refresh,
      });

      await service.getAccessToken(USER_ID, SERVER_ID);

      expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ scopes: 'a b c' }));
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
});
