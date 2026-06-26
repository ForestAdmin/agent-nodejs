import type { EncryptedBlob, TokenCipher } from './token-cipher';

import crypto from 'crypto';

export interface CreateSessionInput {
  saasAccessToken: string;
  saasRefreshToken: string;
  renderingId: number;
  userId: number;
}

export interface StoredSession {
  saasAccessToken: string;
  saasRefreshTokenBlob: EncryptedBlob;
  refreshTokenHash: string;
  renderingId: number;
  userId: number;
  expiresAt: number;
}

export interface CreatedSession {
  sid: string;
  refreshToken: string;
}

export interface UpdateSaasTokensInput {
  saasAccessToken: string;
  saasRefreshToken: string;
}

export interface SessionStore {
  create(input: CreateSessionInput): CreatedSession;
  get(sid: string): StoredSession | undefined;
  getSaasRefreshToken(sid: string): string | undefined;
  updateSaasTokens(sid: string, tokens: UpdateSaasTokensInput): void;
  claimAuthorizationCode(code: string): boolean;
  pendingClaimCount(): number;
}

export interface SessionStoreOptions {
  cipher: TokenCipher;
  now: () => number;
  sessionTtlSeconds: number;
  authCodeTtlSeconds?: number;
  maxPendingCodes?: number;
}

const DEFAULT_AUTH_CODE_TTL_SECONDS = 5 * 60;
const DEFAULT_MAX_PENDING_CODES = 10_000;

export function createSid(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function createOpaqueToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

export default function createInMemorySessionStore({
  cipher,
  now,
  sessionTtlSeconds,
  authCodeTtlSeconds = DEFAULT_AUTH_CODE_TTL_SECONDS,
  maxPendingCodes = DEFAULT_MAX_PENDING_CODES,
}: SessionStoreOptions): SessionStore {
  const sessions = new Map<string, StoredSession>();
  const usedCodes = new Map<string, number>();

  function purgeExpiredCodes(): void {
    const current = now();

    for (const [code, expiresAt] of usedCodes) {
      if (current >= expiresAt) usedCodes.delete(code);
    }
  }

  function purgeExpiredSessions(): void {
    const current = now();

    for (const [sid, session] of sessions) {
      if (current >= session.expiresAt) sessions.delete(sid);
    }
  }

  function evictOldestCode(): void {
    let oldestCode: string | undefined;
    let oldestExpiry = Infinity;

    for (const [code, expiresAt] of usedCodes) {
      if (expiresAt < oldestExpiry) {
        oldestExpiry = expiresAt;
        oldestCode = code;
      }
    }

    if (oldestCode !== undefined) usedCodes.delete(oldestCode);
  }

  function liveSession(sid: string): StoredSession | undefined {
    const session = sessions.get(sid);
    if (!session) return undefined;

    if (now() >= session.expiresAt) {
      sessions.delete(sid);

      return undefined;
    }

    return session;
  }

  return {
    create(input) {
      purgeExpiredSessions();
      const sid = createSid();
      const refreshToken = createOpaqueToken();

      sessions.set(sid, {
        saasAccessToken: input.saasAccessToken,
        saasRefreshTokenBlob: cipher.encrypt(input.saasRefreshToken),
        refreshTokenHash: hashToken(refreshToken),
        renderingId: input.renderingId,
        userId: input.userId,
        expiresAt: now() + sessionTtlSeconds * 1000,
      });

      return { sid, refreshToken };
    },

    get(sid) {
      const session = liveSession(sid);

      return session ? { ...session } : undefined;
    },

    getSaasRefreshToken(sid) {
      const session = liveSession(sid);

      return session ? cipher.decrypt(session.saasRefreshTokenBlob) : undefined;
    },

    updateSaasTokens(sid, tokens) {
      const session = liveSession(sid);
      if (!session) return;

      session.saasAccessToken = tokens.saasAccessToken;
      session.saasRefreshTokenBlob = cipher.encrypt(tokens.saasRefreshToken);
    },

    claimAuthorizationCode(code) {
      purgeExpiredCodes();
      if (usedCodes.has(code)) return false;

      if (usedCodes.size >= maxPendingCodes) {
        evictOldestCode();
        if (usedCodes.size >= maxPendingCodes) return false;
      }

      usedCodes.set(code, now() + authCodeTtlSeconds * 1000);

      return true;
    },

    pendingClaimCount() {
      purgeExpiredCodes();

      return usedCodes.size;
    },
  };
}
