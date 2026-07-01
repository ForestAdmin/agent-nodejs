import crypto from 'crypto';

const API_KEY_PATTERN = /^fbff_([0-9a-f]{16})_([0-9a-f]{64})$/;

export interface ParsedApiKey {
  keyId: string;
  secret: string;
}

export function parseApiKey(raw: string): ParsedApiKey | null {
  const match = API_KEY_PATTERN.exec(raw);

  if (!match) return null;

  return { keyId: match[1], secret: match[2] };
}

export function hashApiKey(keyId: string, secret: string): string {
  return crypto.createHash('sha256').update(`${keyId}:${secret}`).digest('hex');
}

export function fingerprintApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}
