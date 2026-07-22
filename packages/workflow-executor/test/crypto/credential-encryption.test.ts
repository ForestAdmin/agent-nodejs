/**
 * Spec for the at-rest credential encryption helper.
 *
 * Behaviour:
 *  - Key is derived in-process via HKDF (`crypto.hkdfSync`, fixed context label) from a dedicated
 *    secret injected at construction — separate from `FOREST_AUTH_SECRET`.
 *  - The key is used LAZILY (never required at construction / boot; the secret may be undefined).
 *  - AES-GCM is used (authenticated encryption — tampering must be detected on decrypt).
 *  - Fail closed: a missing key (or a failed decrypt) must throw, never return plaintext/garbage.
 *
 * Key rotation is a hard swap (re-consent per (user, server)), not version-aware multi-key decrypt,
 * so there is no enc-key-version concept; `decrypt` takes only the packed ciphertext.
 */
import CredentialEncryption from '../../src/crypto/credential-encryption';
import { ExecutorEncryptionKeyMissingError } from '../../src/errors';

// 32-byte key as 64 hex chars (mirrors the envSecret format validated elsewhere).
const TEST_KEY = 'a'.repeat(64);
const OTHER_KEY = 'b'.repeat(64);

describe('CredentialEncryption', () => {
  describe('round-trip', () => {
    it('decrypts back to the exact plaintext that was encrypted', () => {
      const enc = new CredentialEncryption(TEST_KEY);
      const plaintext = 'refresh-token-abc123';

      const { ciphertext } = enc.encrypt(plaintext);

      expect(enc.decrypt(ciphertext)).toBe(plaintext);
    });

    it('round-trips multi-byte unicode without corruption', () => {
      const enc = new CredentialEncryption(TEST_KEY);
      const plaintext = 'tökén-🔐-Ω-secret';

      const { ciphertext } = enc.encrypt(plaintext);

      expect(enc.decrypt(ciphertext)).toBe(plaintext);
    });

    it('round-trips an empty string (boundary: zero-length plaintext)', () => {
      const enc = new CredentialEncryption(TEST_KEY);

      const { ciphertext } = enc.encrypt('');

      expect(enc.decrypt(ciphertext)).toBe('');
    });
  });

  describe('output shape', () => {
    it('returns ciphertext as a Buffer (blob-storable)', () => {
      const enc = new CredentialEncryption(TEST_KEY);

      const { ciphertext } = enc.encrypt('secret');

      expect(Buffer.isBuffer(ciphertext)).toBe(true);
    });

    it('does not leak the plaintext into the ciphertext bytes', () => {
      const enc = new CredentialEncryption(TEST_KEY);
      const plaintext = 'super-secret-refresh-token';

      const { ciphertext } = enc.encrypt(plaintext);

      expect(ciphertext.toString('utf8')).not.toContain(plaintext);
      expect(ciphertext.toString('latin1')).not.toContain(plaintext);
    });
  });

  describe('non-determinism (random IV per encryption)', () => {
    it('produces different ciphertext for the same plaintext on repeated calls', () => {
      const enc = new CredentialEncryption(TEST_KEY);

      const a = enc.encrypt('same-plaintext');
      const b = enc.encrypt('same-plaintext');

      expect(a.ciphertext.toString('hex')).not.toBe(b.ciphertext.toString('hex'));
    });

    it('still decrypts both independently to the same plaintext', () => {
      const enc = new CredentialEncryption(TEST_KEY);

      const a = enc.encrypt('same-plaintext');
      const b = enc.encrypt('same-plaintext');

      expect(enc.decrypt(a.ciphertext)).toBe('same-plaintext');
      expect(enc.decrypt(b.ciphertext)).toBe('same-plaintext');
    });
  });

  describe('authenticity (AES-GCM) — fail closed on tampering', () => {
    it('throws when a ciphertext byte is flipped', () => {
      const enc = new CredentialEncryption(TEST_KEY);
      const { ciphertext } = enc.encrypt('secret');

      const tampered = Buffer.from(ciphertext.toString('hex'), 'hex');
      const last = tampered.length - 1;
      tampered[last] = (tampered[last] + 1) % 256;

      expect(() => enc.decrypt(tampered)).toThrow();
    });

    it('throws when a byte in the IV region is flipped', () => {
      const enc = new CredentialEncryption(TEST_KEY);
      const { ciphertext } = enc.encrypt('secret');

      // Packed layout is iv | authTag | ciphertext; the IV is the first 12 bytes.
      const tampered = Buffer.from(ciphertext.toString('hex'), 'hex');
      tampered[0] = (tampered[0] + 1) % 256;

      expect(() => enc.decrypt(tampered)).toThrow();
    });

    it('throws when a byte in the auth-tag region is flipped', () => {
      const enc = new CredentialEncryption(TEST_KEY);
      const { ciphertext } = enc.encrypt('secret');

      // The 16-byte auth tag immediately follows the 12-byte IV.
      const tampered = Buffer.from(ciphertext.toString('hex'), 'hex');
      tampered[12] = (tampered[12] + 1) % 256;

      expect(() => enc.decrypt(tampered)).toThrow();
    });

    it('throws when the ciphertext is truncated', () => {
      const enc = new CredentialEncryption(TEST_KEY);
      const { ciphertext } = enc.encrypt('secret');

      const truncated = ciphertext.subarray(0, ciphertext.length - 1);

      expect(() => enc.decrypt(truncated)).toThrow();
    });

    it('throws when decrypting under a different key (cross-key, fail closed)', () => {
      const enc = new CredentialEncryption(TEST_KEY);
      const { ciphertext } = enc.encrypt('secret');

      // Rotate the key out from under the same payload.
      const other = new CredentialEncryption(OTHER_KEY);

      expect(() => other.decrypt(ciphertext)).toThrow();
    });
  });

  describe('key derivation', () => {
    it('derives the same key across instances (empty-salt HKDF is deterministic)', () => {
      const writer = new CredentialEncryption(TEST_KEY);
      const { ciphertext } = writer.encrypt('cross-instance-secret');

      // A separate instance built with the same key must decrypt the payload — this is what lets a
      // restarted or horizontally-scaled executor read rows written by another instance, and pins
      // the empty-salt / fixed-info derivation as stable rather than per-instance.
      const reader = new CredentialEncryption(TEST_KEY);

      expect(reader.decrypt(ciphertext)).toBe('cross-instance-secret');
    });
  });

  describe('lazy key usage', () => {
    it('does not throw at construction when the key is unset', () => {
      expect(() => new CredentialEncryption(undefined)).not.toThrow();
    });

    it('throws ExecutorEncryptionKeyMissingError on encrypt when the key is unset', () => {
      const enc = new CredentialEncryption(undefined);

      expect(() => enc.encrypt('secret')).toThrow(ExecutorEncryptionKeyMissingError);
    });

    it('throws ExecutorEncryptionKeyMissingError on decrypt when the key is unset', () => {
      const enc = new CredentialEncryption(TEST_KEY);
      const { ciphertext } = enc.encrypt('secret');

      const cold = new CredentialEncryption(undefined);

      expect(() => cold.decrypt(ciphertext)).toThrow(ExecutorEncryptionKeyMissingError);
    });
  });
});
