/**
 * Spec for the at-rest credential encryption helper.
 *
 * Behaviour:
 *  - Key is derived in-process via HKDF (`crypto.hkdfSync`, fixed context label) from a dedicated
 *    `FOREST_EXECUTOR_ENCRYPTION_KEY` env var — separate from `FOREST_AUTH_SECRET`.
 *  - The key is read LAZILY (never required at construction / boot).
 *  - AES-GCM is used (authenticated encryption — tampering must be detected on decrypt).
 *  - Fail closed: a missing key (or a failed decrypt) must throw, never return plaintext/garbage.
 *
 * Key rotation is a hard swap (re-consent per (user, server)), not version-aware multi-key decrypt,
 * so there is no enc-key-version concept; `decrypt` takes only the packed ciphertext.
 */
import CredentialEncryption from '../../src/crypto/credential-encryption';
import { ExecutorEncryptionKeyMissingError } from '../../src/errors';

const ENV_KEY = 'FOREST_EXECUTOR_ENCRYPTION_KEY';
// 32-byte key as 64 hex chars (mirrors the envSecret format validated elsewhere).
const TEST_KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

describe('CredentialEncryption', () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    process.env[ENV_KEY] = TEST_KEY;
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  describe('round-trip', () => {
    it('decrypts back to the exact plaintext that was encrypted', () => {
      const enc = new CredentialEncryption();
      const plaintext = 'refresh-token-abc123';

      const { ciphertext } = enc.encrypt(plaintext);

      expect(enc.decrypt(ciphertext)).toBe(plaintext);
    });

    it('round-trips multi-byte unicode without corruption', () => {
      const enc = new CredentialEncryption();
      const plaintext = 'tökén-🔐-Ω-secret';

      const { ciphertext } = enc.encrypt(plaintext);

      expect(enc.decrypt(ciphertext)).toBe(plaintext);
    });

    it('round-trips an empty string (boundary: zero-length plaintext)', () => {
      const enc = new CredentialEncryption();

      const { ciphertext } = enc.encrypt('');

      expect(enc.decrypt(ciphertext)).toBe('');
    });
  });

  describe('output shape', () => {
    it('returns ciphertext as a Buffer (blob-storable)', () => {
      const enc = new CredentialEncryption();

      const { ciphertext } = enc.encrypt('secret');

      expect(Buffer.isBuffer(ciphertext)).toBe(true);
    });

    it('does not leak the plaintext into the ciphertext bytes', () => {
      const enc = new CredentialEncryption();
      const plaintext = 'super-secret-refresh-token';

      const { ciphertext } = enc.encrypt(plaintext);

      expect(ciphertext.toString('utf8')).not.toContain(plaintext);
      expect(ciphertext.toString('latin1')).not.toContain(plaintext);
    });
  });

  describe('non-determinism (random IV per encryption)', () => {
    it('produces different ciphertext for the same plaintext on repeated calls', () => {
      const enc = new CredentialEncryption();

      const a = enc.encrypt('same-plaintext');
      const b = enc.encrypt('same-plaintext');

      expect(a.ciphertext.toString('hex')).not.toBe(b.ciphertext.toString('hex'));
    });

    it('still decrypts both independently to the same plaintext', () => {
      const enc = new CredentialEncryption();

      const a = enc.encrypt('same-plaintext');
      const b = enc.encrypt('same-plaintext');

      expect(enc.decrypt(a.ciphertext)).toBe('same-plaintext');
      expect(enc.decrypt(b.ciphertext)).toBe('same-plaintext');
    });
  });

  describe('authenticity (AES-GCM) — fail closed on tampering', () => {
    it('throws when a ciphertext byte is flipped', () => {
      const enc = new CredentialEncryption();
      const { ciphertext } = enc.encrypt('secret');

      const tampered = Buffer.from(ciphertext.toString('hex'), 'hex');
      const last = tampered.length - 1;
      tampered[last] = (tampered[last] + 1) % 256;

      expect(() => enc.decrypt(tampered)).toThrow();
    });

    it('throws when a byte in the IV region is flipped', () => {
      const enc = new CredentialEncryption();
      const { ciphertext } = enc.encrypt('secret');

      // Packed layout is iv | authTag | ciphertext; the IV is the first 12 bytes.
      const tampered = Buffer.from(ciphertext.toString('hex'), 'hex');
      tampered[0] = (tampered[0] + 1) % 256;

      expect(() => enc.decrypt(tampered)).toThrow();
    });

    it('throws when a byte in the auth-tag region is flipped', () => {
      const enc = new CredentialEncryption();
      const { ciphertext } = enc.encrypt('secret');

      // The 16-byte auth tag immediately follows the 12-byte IV.
      const tampered = Buffer.from(ciphertext.toString('hex'), 'hex');
      tampered[12] = (tampered[12] + 1) % 256;

      expect(() => enc.decrypt(tampered)).toThrow();
    });

    it('throws when the ciphertext is truncated', () => {
      const enc = new CredentialEncryption();
      const { ciphertext } = enc.encrypt('secret');

      const truncated = ciphertext.subarray(0, ciphertext.length - 1);

      expect(() => enc.decrypt(truncated)).toThrow();
    });

    it('throws when decrypting under a different key (cross-key, fail closed)', () => {
      const enc = new CredentialEncryption();
      const { ciphertext } = enc.encrypt('secret');

      // Rotate the host key out from under the same payload.
      process.env[ENV_KEY] = OTHER_KEY;
      const other = new CredentialEncryption();

      expect(() => other.decrypt(ciphertext)).toThrow();
    });
  });

  describe('key derivation', () => {
    it('derives the same key across instances (empty-salt HKDF is deterministic)', () => {
      const writer = new CredentialEncryption();
      const { ciphertext } = writer.encrypt('cross-instance-secret');

      // A separate instance reading the same env key must decrypt the payload — this is what lets a
      // restarted or horizontally-scaled executor read rows written by another instance, and pins
      // the empty-salt / fixed-info derivation as stable rather than per-instance.
      const reader = new CredentialEncryption();

      expect(reader.decrypt(ciphertext)).toBe('cross-instance-secret');
    });
  });

  describe('lazy key reading', () => {
    it('does not throw at construction when the key is unset', () => {
      delete process.env[ENV_KEY];

      expect(() => new CredentialEncryption()).not.toThrow();
    });

    it('throws ExecutorEncryptionKeyMissingError on encrypt when the key is unset', () => {
      delete process.env[ENV_KEY];
      const enc = new CredentialEncryption();

      expect(() => enc.encrypt('secret')).toThrow(ExecutorEncryptionKeyMissingError);
    });

    it('throws ExecutorEncryptionKeyMissingError on decrypt when the key is unset', () => {
      const enc = new CredentialEncryption();
      const { ciphertext } = enc.encrypt('secret');

      delete process.env[ENV_KEY];
      const cold = new CredentialEncryption();

      expect(() => cold.decrypt(ciphertext)).toThrow(ExecutorEncryptionKeyMissingError);
    });
  });
});
