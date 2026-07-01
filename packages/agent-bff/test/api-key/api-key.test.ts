import { fingerprintApiKey, hashApiKey, parseApiKey } from '../../src/api-key/api-key';

const KEY_ID = 'a'.repeat(16);
const SECRET = 'b'.repeat(64);
const VALID = `fbff_${KEY_ID}_${SECRET}`;

describe('parseApiKey', () => {
  describe('when the key matches fbff_<keyId>_<secret>', () => {
    it('should split into keyId and secret', () => {
      expect(parseApiKey(VALID)).toEqual({ keyId: KEY_ID, secret: SECRET });
    });
  });

  describe('when the key is malformed', () => {
    it.each([
      ['missing prefix', `${KEY_ID}_${SECRET}`],
      ['wrong prefix', `fbf_${KEY_ID}_${SECRET}`],
      ['keyId too short', `fbff_${'a'.repeat(15)}_${SECRET}`],
      ['secret too short', `fbff_${KEY_ID}_${'b'.repeat(63)}`],
      ['uppercase hex', `fbff_${'A'.repeat(16)}_${SECRET}`],
      ['empty string', ''],
      ['extra segment', `${VALID}_extra`],
    ])('should return null (%s)', (_label, raw) => {
      expect(parseApiKey(raw)).toBeNull();
    });
  });
});

describe('hashApiKey', () => {
  it('should be stable for the same keyId and secret', () => {
    expect(hashApiKey(KEY_ID, SECRET)).toBe(hashApiKey(KEY_ID, SECRET));
  });

  it('should differ when the secret changes for the same keyId', () => {
    expect(hashApiKey(KEY_ID, SECRET)).not.toBe(hashApiKey(KEY_ID, 'c'.repeat(64)));
  });

  it('should not contain the raw secret', () => {
    expect(hashApiKey(KEY_ID, SECRET)).not.toContain(SECRET);
  });
});

describe('fingerprintApiKey', () => {
  it('should return a 12-char hex fingerprint that excludes the raw secret', () => {
    const fingerprint = fingerprintApiKey(VALID);

    expect(fingerprint).toMatch(/^[0-9a-f]{12}$/);
    expect(fingerprint).not.toContain(SECRET);
  });
});
