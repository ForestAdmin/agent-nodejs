import { createCipheriv, createDecipheriv, hkdfSync, randomFillSync } from 'crypto';

import { ExecutorEncryptionKeyMissingError } from '../errors';

// Fixed context label bound into the HKDF derivation — domain-separates this key from any other
// use of the same secret. Changing it would make every existing row undecryptable.
const HKDF_INFO = 'forest-executor:mcp-oauth-credentials';
const HKDF_DIGEST = 'sha256';
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM standard nonce length
const AUTH_TAG_BYTES = 16;
const ALGORITHM = 'aes-256-gcm';

export interface EncryptedValue {
  // Packed layout: iv | authTag | ciphertext — stored as a single BLOB column.
  ciphertext: Buffer;
}

// Concatenate byte arrays without going through Buffer.concat — keeps everything in the concrete
// Uint8Array<ArrayBuffer> domain the Node crypto types expect.
function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((length, part) => length + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}

// No default key by design: a hardcoded one would ship publicly in this open-source package.
export default class CredentialEncryption {
  constructor(private readonly secret: string | undefined) {}

  encrypt(plaintext: string): EncryptedValue {
    const iv = randomFillSync(new Uint8Array(IV_BYTES));
    const cipher = createCipheriv(ALGORITHM, this.deriveKey(), iv);
    const encrypted = concatBytes([
      new Uint8Array(cipher.update(plaintext, 'utf8')),
      new Uint8Array(cipher.final()),
    ]);
    const authTag = new Uint8Array(cipher.getAuthTag());

    return {
      ciphertext: Buffer.from(concatBytes([iv, authTag, encrypted])),
    };
  }

  decrypt(value: Buffer): string {
    const bytes = new Uint8Array(value);
    const iv = bytes.subarray(0, IV_BYTES);
    const authTag = bytes.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const encrypted = bytes.subarray(IV_BYTES + AUTH_TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, this.deriveKey(), iv);
    decipher.setAuthTag(authTag);

    const decrypted = concatBytes([
      new Uint8Array(decipher.update(encrypted)),
      new Uint8Array(decipher.final()),
    ]);

    return Buffer.from(decrypted).toString('utf8');
  }

  private deriveKey(): Uint8Array {
    const { secret } = this;

    if (!secret) throw new ExecutorEncryptionKeyMissingError();

    // Empty salt is intentional: the fixed HKDF_INFO label gives domain separation and the
    // single high-entropy secret needs no salt. Wrap hkdfSync's ArrayBuffer as a concrete
    // Uint8Array<ArrayBuffer> to satisfy CipherKey (Buffer's ArrayBufferLike backing does not).
    return new Uint8Array(hkdfSync(HKDF_DIGEST, secret, new Uint8Array(0), HKDF_INFO, KEY_BYTES));
  }
}
