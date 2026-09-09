import normalizeBasePath from '../src/base-path';
import { ConfigurationError } from '../src/errors';

describe('normalizeBasePath', () => {
  describe('when the BFF owns the origin root', () => {
    it.each([
      ['nothing', undefined],
      ['an empty string', ''],
      ['blanks', '   '],
      ['the root path', '/'],
    ])('should return an empty prefix for %s, since // would name a host', (_, input) => {
      expect(normalizeBasePath(input)).toBe('');
    });
  });

  describe('when the host serves the BFF under a prefix', () => {
    it.each([
      ['a plain prefix', '/bff', '/bff'],
      ['a missing leading slash', 'bff', '/bff'],
      ['a trailing slash', '/bff/', '/bff'],
      ['duplicated slashes', '//bff//admin//', '/bff/admin'],
      ['surrounding blanks', '  /bff  ', '/bff'],
      ['a nested prefix', '/api/bff', '/api/bff'],
    ])('should normalize %s to an absolute prefix', (_, input, expected) => {
      expect(normalizeBasePath(input)).toBe(expected);
    });
  });

  describe('when the value is not a plain path prefix', () => {
    it.each([
      ['a full url', 'https://bff.example.com/bff'],
      ['a query string', '/bff?key=1'],
      ['a fragment', '/bff#docs'],
      ['a space inside a segment', '/my bff'],
      ['a traversal', '/bff/../admin'],
    ])('should reject %s rather than publish a mount nobody serves', (_, input) => {
      expect(() => normalizeBasePath(input)).toThrow(ConfigurationError);
      expect(() => normalizeBasePath(input)).toThrow(`Invalid BFF base path "${input}"`);
    });
  });
});
