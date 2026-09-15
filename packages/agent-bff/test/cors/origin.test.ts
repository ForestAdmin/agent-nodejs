import {
  hasOrigin,
  normalizeOrigin,
  originAllowed,
  parseAllowedOrigins,
} from '../../src/cors/origin';

describe('hasOrigin', () => {
  it('is false for the empty string koa returns when the header is absent', () => {
    expect(hasOrigin('')).toBe(false);
  });

  it('is true for any present value, even an opaque or malformed one', () => {
    expect(hasOrigin('null')).toBe(true);
    expect(hasOrigin('not a url')).toBe(true);
  });

  it('is false for blank or absent input, the same contract normalizeOrigin takes', () => {
    expect(hasOrigin('   ')).toBe(false);
    expect(hasOrigin(undefined)).toBe(false);
    expect(hasOrigin(null)).toBe(false);
  });
});

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

  it('keeps a leading-label wildcard, normalized like any other entry', () => {
    expect(
      parseAllowedOrigins('HTTPS://*.APPS.ZDUSERCONTENT.COM, https://*.example.com:8443'),
    ).toEqual({
      origins: ['https://*.apps.zdusercontent.com', 'https://*.example.com:8443'],
      invalid: [],
    });
  });

  it('keeps a star outside the host as the exact origin the rest of the URL normalizes to', () => {
    expect(parseAllowedOrigins('https://*@example.com, https://example.com/*')).toEqual({
      origins: ['https://example.com'],
      invalid: [],
    });
  });

  it('treats a percent-encoded star in the leading label as a wildcard', () => {
    expect(originAllowed('https://1231469.example.com', ['https://%2A.example.com'])).toBe(true);
  });

  it.each([
    ['*'],
    ['https://a.*.example.com'],
    ['https://*.*.example.com'],
    ['https://*'],
    ['https://*.com'],
    ['https://*.com.'],
    ['https://*..com'],
    ['https://*.localhost'],
    ['https://*.127.0.0.1'],
  ])('rejects the illegal pattern %s into invalid', entry => {
    expect(parseAllowedOrigins(entry)).toEqual({ origins: [], invalid: [entry] });
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

  describe('with a leading-label wildcard entry', () => {
    const zendesk = ['https://*.apps.zdusercontent.com'];

    it('matches exactly one label in place of the star', () => {
      expect(originAllowed('https://1231469.apps.zdusercontent.com', zendesk)).toBe(true);
    });

    it('does not match two labels in place of the star', () => {
      expect(originAllowed('https://a.b.apps.zdusercontent.com', zendesk)).toBe(false);
    });

    it('does not match the apex the pattern is built on', () => {
      expect(originAllowed('https://apps.zdusercontent.com', zendesk)).toBe(false);
    });

    it('does not match a host that merely ends with the same characters', () => {
      expect(originAllowed('https://evil-apps.zdusercontent.com', zendesk)).toBe(false);
    });

    it('is case-insensitive on the host, like normalizeOrigin', () => {
      expect(originAllowed('https://1231469.APPS.ZDUSERCONTENT.COM', zendesk)).toBe(true);
      expect(originAllowed('https://x.example.com', ['HTTPS://*.EXAMPLE.COM'])).toBe(true);
    });

    it('requires the scheme to match exactly', () => {
      expect(originAllowed('http://1231469.apps.zdusercontent.com', zendesk)).toBe(false);
    });

    it('requires the port to match exactly', () => {
      expect(originAllowed('https://x.example.com:8443', ['https://*.example.com'])).toBe(false);
      expect(originAllowed('https://x.example.com', ['https://*.example.com:8443'])).toBe(false);
      expect(originAllowed('https://x.example.com:8443', ['https://*.example.com:8443'])).toBe(
        true,
      );
    });

    it('normalizes the default port on both sides', () => {
      expect(originAllowed('https://x.example.com:443', ['https://*.example.com'])).toBe(true);
    });

    it('never matches through an illegal pattern', () => {
      expect(originAllowed('https://evil.com', ['https://*.com'])).toBe(false);
      expect(originAllowed('https://evil.com.', ['https://*.com.'])).toBe(false);
      expect(originAllowed('https://a.b.example.com', ['https://a.*.example.com'])).toBe(false);
    });

    it('leaves entries without a star on strict equality', () => {
      expect(originAllowed('https://x.a.com', ['https://a.com'])).toBe(false);
      expect(originAllowed('https://a.com', ['https://a.com'])).toBe(true);
    });
  });
});
