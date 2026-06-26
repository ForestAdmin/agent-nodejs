import createTokenCipher from '../../src/oauth/token-cipher';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('token-cipher', () => {
  describe('when encrypting then decrypting', () => {
    it('should round-trip the plaintext', () => {
      const cipher = createTokenCipher(KEY);
      const plaintext = 'SAAS-REFRESH-SENTINEL';

      expect(cipher.decrypt(cipher.encrypt(plaintext))).toBe(plaintext);
    });

    it('should not expose the plaintext in the serialized output', () => {
      const cipher = createTokenCipher(KEY);
      const plaintext = 'SAAS-REFRESH-SENTINEL';

      expect(JSON.stringify(cipher.encrypt(plaintext))).not.toContain(plaintext);
    });

    it('should produce { iv, authTag, ciphertext } as base64 fields', () => {
      const cipher = createTokenCipher(KEY);
      const blob = cipher.encrypt('x');

      expect(blob).toEqual({
        iv: expect.any(String),
        authTag: expect.any(String),
        ciphertext: expect.any(String),
      });
      expect(Buffer.from(blob.iv, 'base64').length).toBe(12);
    });
  });

  describe('when the same plaintext is encrypted twice', () => {
    it('should use a fresh random IV so the ciphertexts differ', () => {
      const cipher = createTokenCipher(KEY);

      expect(cipher.encrypt('same').ciphertext).not.toBe(cipher.encrypt('same').ciphertext);
    });
  });

  describe('when the blob is tampered with', () => {
    it('should throw on a mutated authTag (GCM authentication)', () => {
      const cipher = createTokenCipher(KEY);
      const blob = cipher.encrypt('payload');
      const tampered = { ...blob, authTag: Buffer.alloc(16, 1).toString('base64') };

      expect(() => cipher.decrypt(tampered)).toThrow();
    });

    it('should throw on a mutated ciphertext', () => {
      const cipher = createTokenCipher(KEY);
      const blob = cipher.encrypt('payload');
      const flipped = Buffer.from(blob.ciphertext, 'base64');
      flipped[0] = (flipped[0] + 1) % 256;
      const tampered = { ...blob, ciphertext: flipped.toString('base64') };

      expect(() => cipher.decrypt(tampered)).toThrow();
    });
  });

  describe('when a different key decrypts', () => {
    it('should throw', () => {
      const blob = createTokenCipher(KEY).encrypt('payload');
      const other = createTokenCipher(Buffer.alloc(32, 9).toString('base64'));

      expect(() => other.decrypt(blob)).toThrow();
    });
  });
});
