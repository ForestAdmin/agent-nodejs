import { hkdfSync } from 'crypto';

const HKDF_DIGEST = 'sha256';
const HKDF_INFO = 'forest-bff:bff_access:v1';
const KEY_BYTES = 32;

/**
 * The key signing `bff_access` tokens, derived from `BFF_TOKEN_ENCRYPTION_KEY` so they never share a
 * key with the agent's `FOREST_AUTH_SECRET`. Empty salt on purpose: the fixed label separates the
 * domain, and the input is already a high-entropy key.
 */
export default function deriveBffAccessKey(base64TokenEncryptionKey: string): Buffer {
  return Buffer.from(
    hkdfSync(
      HKDF_DIGEST,
      new Uint8Array(Buffer.from(base64TokenEncryptionKey, 'base64')),
      new Uint8Array(0),
      HKDF_INFO,
      KEY_BYTES,
    ),
  );
}
