import { normalizeOrigin, originAllowed, parseAllowedOrigins } from '../../src/cors/origin';

describe('normalizeOrigin', () => {
  it.each([
    ['https://x.com', 'https://x.com'],
    ['https://x.com:443', 'https://x.com'],
    ['http://x.com:80', 'http://x.com'],
    ['https://X.COM', 'https://x.com'],
    ['https://x.com/', 'https://x.com'],
    ['https://x.com/some/path', 'https://x.com'],
    ['https://x.com:8443', 'https://x.com:8443'],
    ['  https://x.com  ', 'https://x.com'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeOrigin(input)).toBe(expected);
  });

  it.each([['*'], ['not a url'], [''], ['null'], ['/relative']])(
    'returns null for the non-origin %s',
    input => {
      expect(normalizeOrigin(input)).toBeNull();
    },
  );

  it('returns null for undefined and null', () => {
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(normalizeOrigin(null)).toBeNull();
  });
});

describe('parseAllowedOrigins', () => {
  it('normalizes and keeps valid comma-separated entries', () => {
    expect(parseAllowedOrigins('https://a.com, https://b.com:8443')).toEqual({
      origins: ['https://a.com', 'https://b.com:8443'],
      invalid: [],
    });
  });

  it('drops malformed and wildcard entries into invalid', () => {
    expect(parseAllowedOrigins('https://a.com, *, garbage')).toEqual({
      origins: ['https://a.com'],
      invalid: ['*', 'garbage'],
    });
  });

  it('deduplicates entries that normalize to the same origin', () => {
    expect(parseAllowedOrigins('https://a.com, https://a.com:443')).toEqual({
      origins: ['https://a.com'],
      invalid: [],
    });
  });

  it('returns empty lists when unset or blank', () => {
    expect(parseAllowedOrigins(undefined)).toEqual({ origins: [], invalid: [] });
    expect(parseAllowedOrigins('   ')).toEqual({ origins: [], invalid: [] });
  });
});

describe('originAllowed', () => {
  const allowList = ['https://a.com'];

  it('matches after normalization ignoring the default port', () => {
    expect(originAllowed('https://a.com:443', allowList)).toBe(true);
  });

  it('rejects an origin not in the list', () => {
    expect(originAllowed('https://c.com', allowList)).toBe(false);
  });

  it('rejects an absent origin', () => {
    expect(originAllowed(undefined, allowList)).toBe(false);
  });
});
