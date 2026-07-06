import type { RefreshGrantParams, RefreshGrantResult } from './refresh-grant';
import type CredentialEncryption from '../crypto/credential-encryption';
import type { Logger } from '../ports/logger-port';
import type {
  McpOAuthCredentialsStore,
  StoredMcpOAuthCredential,
} from '../ports/mcp-oauth-credentials-store';

import { DEFAULT_OAUTH_EXPIRY_SKEW_S } from '../defaults';
import {
  ExecutorEncryptionKeyMissingError,
  OAuthInvalidGrantError,
  OAuthReauthRequiredError,
} from '../errors';
import KeyedMutex from './keyed-mutex';
import defaultRefreshAccessToken from './refresh-grant';

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

export interface OAuthTokenServiceOptions {
  store: McpOAuthCredentialsStore;
  encryption: CredentialEncryption;
  logger?: Logger;
  expirySkewS?: number;
  refreshAccessToken?: (params: RefreshGrantParams) => Promise<RefreshGrantResult>;
  now?: () => number;
}

// Acquires an MCP OAuth access token for a (user, server): serves a cached token until it nears
// expiry, otherwise runs the refresh-token grant under a per-key mutex (one in-flight refresh per
// user+server in this process) and recovers from a concurrent refresh-token rotation via a single
// re-read + retry. A missing credential or a genuinely rejected refresh raises
// OAuthReauthRequiredError so the step pauses for re-authentication.
export default class OAuthTokenService {
  private readonly store: McpOAuthCredentialsStore;
  private readonly encryption: CredentialEncryption;
  private readonly logger?: Logger;
  private readonly expirySkewMs: number;
  private readonly refreshAccessToken: (params: RefreshGrantParams) => Promise<RefreshGrantResult>;
  private readonly now: () => number;
  private readonly cache = new Map<string, CachedToken>();
  private readonly mutex = new KeyedMutex();
  // Bumped on evict() so a refresh already in flight for a key can detect a disconnect that landed
  // mid-refresh and skip repopulating the cache for the now-deleted credential.
  private readonly evictionEpoch = new Map<string, number>();

  constructor(options: OAuthTokenServiceOptions) {
    this.store = options.store;
    this.encryption = options.encryption;
    this.logger = options.logger;
    this.expirySkewMs = (options.expirySkewS ?? DEFAULT_OAUTH_EXPIRY_SKEW_S) * 1000;
    this.refreshAccessToken = options.refreshAccessToken ?? defaultRefreshAccessToken;
    this.now = options.now ?? Date.now;
  }

  async getAccessToken(
    userId: number,
    mcpServerId: string,
    options?: { forceRefresh?: boolean },
  ): Promise<string> {
    const key = `${userId}:${mcpServerId}`;
    const forceRefresh = options?.forceRefresh ?? false;

    if (!forceRefresh) {
      const cached = this.readCache(key);
      if (cached) return cached;
    }

    return this.mutex.runExclusive(key, async () => {
      // Re-check inside the lock: a concurrent caller may have just refreshed for this key.
      if (!forceRefresh) {
        const cached = this.readCache(key);
        if (cached) return cached;
      }

      return this.refreshAndCache(userId, mcpServerId, key);
    });
  }

  // Drop the cached access token for a (user, server). Called on credential delete so a disconnect
  // takes effect immediately, instead of the executor serving the cached token until it expires.
  evict(userId: number, mcpServerId: string): void {
    const key = `${userId}:${mcpServerId}`;
    this.cache.delete(key);
    this.evictionEpoch.set(key, (this.evictionEpoch.get(key) ?? 0) + 1);
  }

  private readCache(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (this.now() >= entry.expiresAtMs - this.expirySkewMs) {
      // Drop expired entries on read so the cache can't grow without bound across many keys.
      this.cache.delete(key);

      return undefined;
    }

    return entry.accessToken;
  }

  private async refreshAndCache(userId: number, mcpServerId: string, key: string): Promise<string> {
    const epochAtStart = this.evictionEpoch.get(key) ?? 0;
    const credential = await this.store.get(userId, mcpServerId);
    if (!credential) throw new OAuthReauthRequiredError(mcpServerId);

    const { result, credential: grantedCredential } = await this.runGrantWithRotationRetry(
      credential,
      userId,
      mcpServerId,
    );

    const evictedDuringRefresh = (this.evictionEpoch.get(key) ?? 0) !== epochAtStart;

    // Don't cache when the credential was disconnected while this refresh was in flight (else the
    // just-minted token would be served to later calls for a deleted credential), nor when the grant
    // carried no expiry (never servable). The in-flight caller still receives its token below.
    if (!evictedDuringRefresh && result.expiresInS !== undefined) {
      this.cache.set(key, {
        accessToken: result.accessToken,
        expiresAtMs: this.now() + result.expiresInS * 1000,
      });
    } else {
      this.cache.delete(key);
    }

    if (result.refreshToken) {
      await this.persistRotatedRefreshToken(grantedCredential, result.refreshToken);
    }

    return result.accessToken;
  }

  // On invalid_grant a peer instance likely rotated the refresh token out from under us: re-read the
  // row and retry once with the current token; a second invalid_grant (or an unchanged token) is a
  // genuine revocation and forces re-auth. Returns the credential whose token produced the grant so
  // the caller writes the rotated token back onto that (current) row, not the stale one.
  private async runGrantWithRotationRetry(
    credential: StoredMcpOAuthCredential,
    userId: number,
    mcpServerId: string,
  ): Promise<{ result: RefreshGrantResult; credential: StoredMcpOAuthCredential }> {
    try {
      const result = await this.refreshAccessToken(this.toGrantParams(credential));

      return { result, credential };
    } catch (error) {
      if (!(error instanceof OAuthInvalidGrantError)) throw error;

      // A peer rotated the refresh token iff the stored value changed since we read it.
      const latest = await this.store.get(userId, mcpServerId);
      const wasRotated =
        latest !== null &&
        latest.refreshTokenEnc.toString('base64') !== credential.refreshTokenEnc.toString('base64');

      if (!latest || !wasRotated) {
        throw new OAuthReauthRequiredError(mcpServerId);
      }

      try {
        const result = await this.refreshAccessToken(this.toGrantParams(latest));

        return { result, credential: latest };
      } catch (retryError) {
        if (retryError instanceof OAuthInvalidGrantError) {
          throw new OAuthReauthRequiredError(mcpServerId);
        }

        throw retryError;
      }
    }
  }

  // Decrypt happens here. A decrypt failure with the key PRESENT (auth-tag mismatch — the row was
  // encrypted under a since-rotated/hard-swapped key, or is corrupt) is recoverable: re-consent
  // re-deposits under the current key, so surface it as needs-oauth-reauth. A missing key
  // (ExecutorEncryptionKeyMissingError) is an operator misconfig, not re-consent-resolvable, so it
  // propagates as a terminal error (a re-deposit would just 503 at the deposit endpoint).
  private toGrantParams(credential: StoredMcpOAuthCredential): RefreshGrantParams {
    try {
      return {
        tokenEndpoint: credential.tokenEndpoint,
        refreshToken: this.encryption.decrypt(credential.refreshTokenEnc),
        clientId: credential.clientId,
        clientSecret: credential.clientSecretEnc
          ? this.encryption.decrypt(credential.clientSecretEnc)
          : null,
        tokenEndpointAuthMethod: credential.tokenEndpointAuthMethod,
        scopes: credential.scopes,
      };
    } catch (error) {
      if (error instanceof ExecutorEncryptionKeyMissingError) throw error;

      throw new OAuthReauthRequiredError(credential.mcpServerId);
    }
  }

  private async persistRotatedRefreshToken(
    credential: StoredMcpOAuthCredential,
    refreshToken: string,
  ): Promise<void> {
    try {
      const encrypted = this.encryption.encrypt(refreshToken);

      // Id-scoped so a disconnect (or disconnect + re-authorize) after the grant read leaves an
      // absent or different row — the rotated-token write-back then can't resurrect or clobber it.
      await this.store.updateIfPresent(credential.id, {
        userId: credential.userId,
        mcpServerId: credential.mcpServerId,
        refreshTokenEnc: encrypted.ciphertext,
        clientId: credential.clientId,
        clientSecretEnc: credential.clientSecretEnc,
        clientSecretExpiresAt: credential.clientSecretExpiresAt,
        tokenEndpoint: credential.tokenEndpoint,
        tokenEndpointAuthMethod: credential.tokenEndpointAuthMethod,
        scopes: credential.scopes,
      });
    } catch (error) {
      // A failed write-back is not fatal: the access token just obtained is valid for this call.
      // The rotated refresh token is lost, so a later refresh forces re-authentication — the safe
      // fallback, and better than failing the current operation over a transient write error.
      this.logger?.('Error', 'Failed to persist rotated MCP OAuth refresh token', {
        mcpServerId: credential.mcpServerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
