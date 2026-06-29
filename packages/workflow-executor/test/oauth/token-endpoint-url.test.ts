import { InvalidTokenEndpointError } from '../../src/errors';
import assertSafeTokenEndpoint from '../../src/oauth/token-endpoint-url';

describe('assertSafeTokenEndpoint', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  describe('any environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('accepts an https endpoint with a public host', () => {
      expect(() => assertSafeTokenEndpoint('https://idp.example.com/oauth/token')).not.toThrow();
    });

    it('accepts http on loopback off-production (the local OAuth sim)', () => {
      expect(() => assertSafeTokenEndpoint('http://127.0.0.1:9100/token')).not.toThrow();
      expect(() => assertSafeTokenEndpoint('http://localhost:9100/token')).not.toThrow();
    });

    it('rejects a value that is not a valid absolute URL', () => {
      expect(() => assertSafeTokenEndpoint('not a url')).toThrow(InvalidTokenEndpointError);
    });

    it('rejects a non-http(s) scheme', () => {
      expect(() => assertSafeTokenEndpoint('file:///etc/passwd')).toThrow(
        InvalidTokenEndpointError,
      );
      expect(() => assertSafeTokenEndpoint('ftp://idp/token')).toThrow(InvalidTokenEndpointError);
    });

    it('rejects a link-local / cloud-metadata address even off-production', () => {
      expect(() => assertSafeTokenEndpoint('http://169.254.169.254/latest/meta-data')).toThrow(
        InvalidTokenEndpointError,
      );
      expect(() => assertSafeTokenEndpoint('https://169.254.169.254/token')).toThrow(
        InvalidTokenEndpointError,
      );
    });

    it('rejects an IPv6 link-local address', () => {
      expect(() => assertSafeTokenEndpoint('http://[fe80::1]/token')).toThrow(
        InvalidTokenEndpointError,
      );
    });
  });

  describe('in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('requires https (rejects http)', () => {
      expect(() => assertSafeTokenEndpoint('http://idp.example.com/token')).toThrow(
        InvalidTokenEndpointError,
      );
    });

    it('rejects loopback (the executor host itself)', () => {
      expect(() => assertSafeTokenEndpoint('https://127.0.0.1/token')).toThrow(
        InvalidTokenEndpointError,
      );
      expect(() => assertSafeTokenEndpoint('https://localhost/token')).toThrow(
        InvalidTokenEndpointError,
      );
      expect(() => assertSafeTokenEndpoint('https://[::1]/token')).toThrow(
        InvalidTokenEndpointError,
      );
    });

    it('still allows a private RFC1918 host over https (private providers are supported)', () => {
      expect(() => assertSafeTokenEndpoint('https://10.0.0.5/token')).not.toThrow();
      expect(() => assertSafeTokenEndpoint('https://192.168.1.10:8443/token')).not.toThrow();
    });

    it('accepts a public https endpoint', () => {
      expect(() => assertSafeTokenEndpoint('https://idp.example.com/oauth/token')).not.toThrow();
    });
  });
});
