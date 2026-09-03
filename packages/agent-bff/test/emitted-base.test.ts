import { resolveEmittedBase } from '../src/base-path';

describe('resolveEmittedBase', () => {
  describe('when the host preserved the untouched url', () => {
    it('should return the prefix the caller actually reached the BFF under', () => {
      expect(resolveEmittedBase('/api/bff/docs', '/docs', '/bff')).toBe('/api/bff');
    });

    it('should not re-append the configured prefix, which the untouched url already carries', () => {
      expect(resolveEmittedBase('/bff/docs', '/docs', '/bff')).toBe('/bff');
    });

    it('should keep the query string out of the prefix, since both urls carry it', () => {
      expect(resolveEmittedBase('/api/bff/docs?x=1', '/docs?x=1', '/bff')).toBe('/api/bff');
    });

    it('should return an empty prefix when the BFF owns the origin root', () => {
      expect(resolveEmittedBase('/docs', '/docs', '')).toBe('');
    });

    it('should not leave a trailing slash for a host mounted at the root', () => {
      expect(resolveEmittedBase('//docs', '/docs', '/bff')).toBe('');
    });
  });

  describe('when the two urls cannot be related', () => {
    it('should fall back to the configured prefix rather than guess', () => {
      expect(resolveEmittedBase('/rewritten/elsewhere', '/docs', '/bff')).toBe('/bff');
    });

    it('should fall back when the host preserved nothing, as a standalone deployment does', () => {
      expect(resolveEmittedBase(undefined, '/docs', '')).toBe('');
    });
  });
});
