import type { EncryptedBlob, TokenCipher } from './token-cipher';

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

export interface SessionTokenCodec {
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

function open(cipher: TokenCipher, sealed: string, type: string): Record<string, unknown> | null {
  try {
    const blob: unknown = JSON.parse(Buffer.from(sealed, 'base64url').toString('utf8'));
    if (!isBlob(blob)) return null;

    const payload: unknown = JSON.parse(cipher.decrypt(blob));

    return isRecord(payload) && payload.typ === type ? payload : null;
  } catch {
    return null;
  }
}

function toSessionState(payload: Record<string, unknown>): SessionState | undefined {
  const { sid, saasRefreshToken, renderingId, userId, clientId, expiresAt } = payload;

  if (
    !isNonEmptyString(sid) ||
    !isNonEmptyString(saasRefreshToken) ||
    !Number.isInteger(renderingId) ||
    !Number.isInteger(userId) ||
    !isNonEmptyString(clientId) ||
    typeof expiresAt !== 'number'
  ) {
    return undefined;
  }

  return {
    sid,
    saasRefreshToken,
    renderingId: renderingId as number,
    userId: userId as number,
    clientId,
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
  now: () => number,
): SessionTokenCodec {
  return {
    sealRefreshToken(state) {
      return seal(cipher, { typ: REFRESH_TYPE, ...state });
    },

    openRefreshToken(token) {
      const payload = open(cipher, token, REFRESH_TYPE);
      const state = payload ? toSessionState(payload) : undefined;

      return state && now() < state.expiresAt ? state : undefined;
    },

    sealServerAccess(binding, saasAccessToken) {
      return seal(cipher, { typ: SERVER_ACCESS_TYPE, ...binding, saasAccessToken });
    },

    openServerAccess(sealed, binding) {
      const payload = open(cipher, sealed, SERVER_ACCESS_TYPE);

      if (!payload || !matchesBinding(payload, binding)) return undefined;

      return isNonEmptyString(payload.saasAccessToken) ? payload.saasAccessToken : undefined;
    },
  };
}
