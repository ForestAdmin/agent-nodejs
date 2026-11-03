import type { EncryptedBlob, TokenCipher } from './token-cipher';
import type { Logger } from '../ports/logger-port';

import crypto from 'crypto';

const REFRESH_TYPE = 'bff_refresh';
const SERVER_ACCESS_TYPE = 'bff_server_access';

export interface SessionState {
  sid: string;
  saasRefreshToken: string;
  renderingId: number;
  userId: number;
  clientId: string;
  expiresAt: number;
}

export interface ServerAccessBinding {
  sid: string;
  userId: number;
  renderingId: number;
}

export interface SessionTokenCodecOptions {
  now: () => number;
  sessionTtlSeconds: number;
  logger: Logger;
}

export interface SessionTokenCodec {
  newSessionExpiresAt(): number;
  remainingSeconds(state: SessionState): number;
  sealRefreshToken(state: SessionState): string;
  openRefreshToken(token: string): SessionState | undefined;
  sealServerAccess(binding: ServerAccessBinding, saasAccessToken: string): string;
  openServerAccess(sealed: string, binding: ServerAccessBinding): string | undefined;
}

export function createSid(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

function isBlob(value: unknown): value is EncryptedBlob {
  return (
    isRecord(value) &&
    typeof value.iv === 'string' &&
    typeof value.authTag === 'string' &&
    typeof value.ciphertext === 'string'
  );
}

function seal(cipher: TokenCipher, payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(cipher.encrypt(JSON.stringify(payload)))).toString('base64url');
}

function parseBlob(sealed: string): EncryptedBlob | null {
  try {
    const blob: unknown = JSON.parse(Buffer.from(sealed, 'base64url').toString('utf8'));

    return isBlob(blob) ? blob : null;
  } catch {
    return null;
  }
}

function decrypt(cipher: TokenCipher, blob: EncryptedBlob, logger: Logger): string | null {
  try {
    return cipher.decrypt(blob);
  } catch {
    logger(
      'Warn',
      'A sealed session token does not decrypt under BFF_TOKEN_ENCRYPTION_KEY: it was sealed under another key or altered',
    );

    return null;
  }
}

function parsePayload(plaintext: string, type: string): Record<string, unknown> | null {
  try {
    const payload: unknown = JSON.parse(plaintext);

    return isRecord(payload) && payload.typ === type ? payload : null;
  } catch {
    return null;
  }
}

function open(
  cipher: TokenCipher,
  sealed: string,
  type: string,
  logger: Logger,
): Record<string, unknown> | null {
  const blob = parseBlob(sealed);
  const plaintext = blob ? decrypt(cipher, blob, logger) : null;

  return plaintext === null ? null : parsePayload(plaintext, type);
}

function toSessionState(payload: Record<string, unknown>): SessionState | undefined {
  const { sid, saasRefreshToken, renderingId, userId, clientId, expiresAt } = payload;

  const hasStrings = [sid, saasRefreshToken, clientId].every(isNonEmptyString);
  const hasIntegers = [renderingId, userId].every(value => Number.isInteger(value));

  if (!hasStrings || !hasIntegers || typeof expiresAt !== 'number') return undefined;

  return {
    sid: sid as string,
    saasRefreshToken: saasRefreshToken as string,
    renderingId: renderingId as number,
    userId: userId as number,
    clientId: clientId as string,
    expiresAt,
  };
}

function matchesBinding(payload: Record<string, unknown>, binding: ServerAccessBinding): boolean {
  return (
    payload.sid === binding.sid &&
    payload.userId === binding.userId &&
    payload.renderingId === binding.renderingId
  );
}

export default function createSessionTokenCodec(
  cipher: TokenCipher,
  { now, sessionTtlSeconds, logger }: SessionTokenCodecOptions,
): SessionTokenCodec {
  return {
    newSessionExpiresAt() {
      return now() + sessionTtlSeconds * 1000;
    },

    remainingSeconds(state) {
      return Math.floor((state.expiresAt - now()) / 1000);
    },

    sealRefreshToken(state) {
      return seal(cipher, { typ: REFRESH_TYPE, ...state });
    },

    openRefreshToken(token) {
      const payload = open(cipher, token, REFRESH_TYPE, logger);
      const state = payload ? toSessionState(payload) : undefined;

      return state && now() < state.expiresAt ? state : undefined;
    },

    sealServerAccess(binding, saasAccessToken) {
      return seal(cipher, { typ: SERVER_ACCESS_TYPE, ...binding, saasAccessToken });
    },

    openServerAccess(sealed, binding) {
      const payload = open(cipher, sealed, SERVER_ACCESS_TYPE, logger);

      if (!payload || !matchesBinding(payload, binding)) return undefined;

      return isNonEmptyString(payload.saasAccessToken) ? payload.saasAccessToken : undefined;
    },
  };
}
