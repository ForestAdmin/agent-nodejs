import crypto from 'crypto';

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export function createVerifier(): string {
  return base64url(crypto.randomBytes(64));
}

export function challengeFromVerifier(verifier: string): string {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

export function createPkcePair(): PkcePair {
  const codeVerifier = createVerifier();

  return { codeVerifier, codeChallenge: challengeFromVerifier(codeVerifier) };
}
