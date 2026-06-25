import { REQUIRED_KEYS, parseConfig } from '../../src/config/env-config';
import DEFAULT_BFF_PORT from '../../src/defaults';
import { ConfigurationError } from '../../src/errors';

const VALID_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
} satisfies NodeJS.ProcessEnv;

describe('parseConfig', () => {
  describe('when all required vars are present', () => {
    it('should report every required key present and hasAllRequired true', () => {
      const config = parseConfig({ ...VALID_ENV });

      expect(config.hasAllRequired).toBe(true);
      expect(config.presence).toEqual({
        FOREST_AUTH_SECRET: true,
        FOREST_ENV_SECRET: true,
        FOREST_SERVER_URL: true,
        FOREST_APP_URL: true,
        AGENT_URL: true,
      });
    });
  });

  describe('when a required var is unset, empty, or whitespace-only', () => {
    for (const key of REQUIRED_KEYS) {
      for (const [label, value] of [
        ['unset', undefined],
        ['empty', ''],
        ['whitespace', '   '],
      ] as const) {
        it(`should mark ${key} false and hasAllRequired false when ${label}`, () => {
          const config = parseConfig({ ...VALID_ENV, [key]: value });

          expect(config.presence[key]).toBe(false);
          expect(config.hasAllRequired).toBe(false);
        });
      }
    }
  });

  describe('when a value is malformed', () => {
    for (const key of ['FOREST_SERVER_URL', 'FOREST_APP_URL', 'AGENT_URL'] as const) {
      it(`should throw ConfigurationError when ${key} is not a valid URL`, () => {
        expect(() => parseConfig({ ...VALID_ENV, [key]: 'not-a-url' })).toThrow(ConfigurationError);
      });

      for (const scheme of ['mailto:a@b.com', 'ftp://host/file', 'ws://host'] as const) {
        it(`should throw when ${key} is a non-http(s) scheme (${scheme})`, () => {
          expect(() => parseConfig({ ...VALID_ENV, [key]: scheme })).toThrow(ConfigurationError);
        });
      }
    }

    for (const value of ['abc', '-1', '99999', '0x10', '1e3', '3.5'] as const) {
      it(`should throw ConfigurationError when HTTP_PORT is "${value}"`, () => {
        expect(() => parseConfig({ ...VALID_ENV, HTTP_PORT: value })).toThrow(ConfigurationError);
      });
    }

    it('should not echo the offending value in the error message', () => {
      expect(() => parseConfig({ ...VALID_ENV, AGENT_URL: 'super-secret-bad-value' })).toThrow(
        /must be a valid http\(s\) URL/,
      );
      expect(() => parseConfig({ ...VALID_ENV, AGENT_URL: 'super-secret-bad-value' })).not.toThrow(
        /super-secret-bad-value/,
      );
    });
  });

  describe('when resolving HTTP_PORT', () => {
    it('should default to 3450 when unset', () => {
      expect(parseConfig({ ...VALID_ENV }).httpPort).toBe(DEFAULT_BFF_PORT);
    });

    it('should default to 3450 when empty or whitespace-only', () => {
      expect(parseConfig({ ...VALID_ENV, HTTP_PORT: '' }).httpPort).toBe(DEFAULT_BFF_PORT);
      expect(parseConfig({ ...VALID_ENV, HTTP_PORT: '   ' }).httpPort).toBe(DEFAULT_BFF_PORT);
    });

    it('should use the provided value when valid', () => {
      expect(parseConfig({ ...VALID_ENV, HTTP_PORT: '8080' }).httpPort).toBe(8080);
    });

    it('should accept 0 (OS-assigned ephemeral port)', () => {
      expect(parseConfig({ ...VALID_ENV, HTTP_PORT: '0' }).httpPort).toBe(0);
    });
  });
});
