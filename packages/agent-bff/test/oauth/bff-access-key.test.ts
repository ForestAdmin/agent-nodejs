import deriveBffAccessKey from '../../src/oauth/bff-access-key';

const BYTES_0_TO_31_BASE64 = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=';
/**
 * HKDF-SHA256 of the decoded key, empty salt, info `forest-bff:bff_access:v1`, 32 bytes, computed
 * with an independent RFC 5869 implementation.
 */
const EXPECTED_KEY_HEX = '0e746828f6b177815bfcd726f6751dbed84b4e8279cb2eec6327b6eb06e798d8';

describe('deriveBffAccessKey', () => {
  it('derives the expected 32-byte key from the decoded encryption key', () => {
    const key = deriveBffAccessKey(BYTES_0_TO_31_BASE64);

    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.toString('hex')).toBe(EXPECTED_KEY_HEX);
  });

  it('differs from the encryption key it is derived from', () => {
    const key = deriveBffAccessKey(BYTES_0_TO_31_BASE64);

    expect(key.toString('hex')).not.toBe(
      Buffer.from(BYTES_0_TO_31_BASE64, 'base64').toString('hex'),
    );
  });

  it('derives a different key from a different encryption key', () => {
    const other = Buffer.alloc(32, 0xff).toString('base64');

    expect(deriveBffAccessKey(other).toString('hex')).not.toBe(EXPECTED_KEY_HEX);
  });
});
