import { ConfigurationError } from '../src/errors';
import validateSecrets from '../src/validate-secrets';

const VALID_ENV_SECRET = 'a'.repeat(64);
const VALID_AUTH_SECRET = 'my-auth-secret';

describe('validateSecrets', () => {
  it('does not throw when both secrets are valid', () => {
    expect(() =>
      validateSecrets({ envSecret: VALID_ENV_SECRET, authSecret: VALID_AUTH_SECRET }),
    ).not.toThrow();
  });

  describe('authSecret', () => {
    it('throws ConfigurationError when authSecret is empty', () => {
      expect(() => validateSecrets({ envSecret: VALID_ENV_SECRET, authSecret: '' })).toThrow(
        ConfigurationError,
      );
    });

    it('throws ConfigurationError with descriptive message', () => {
      expect(() => validateSecrets({ envSecret: VALID_ENV_SECRET, authSecret: '' })).toThrow(
        'authSecret must be a non-empty string',
      );
    });
  });

  describe('envSecret', () => {
    it('throws ConfigurationError when envSecret is empty', () => {
      expect(() => validateSecrets({ envSecret: '', authSecret: VALID_AUTH_SECRET })).toThrow(
        ConfigurationError,
      );
    });

    it('throws ConfigurationError when envSecret is not 64 chars', () => {
      expect(() => validateSecrets({ envSecret: 'abc', authSecret: VALID_AUTH_SECRET })).toThrow(
        ConfigurationError,
      );
    });

    it('throws ConfigurationError when envSecret contains non-hex chars', () => {
      const nonHex = 'g'.repeat(64);
      expect(() => validateSecrets({ envSecret: nonHex, authSecret: VALID_AUTH_SECRET })).toThrow(
        ConfigurationError,
      );
    });

    it('throws ConfigurationError when envSecret contains uppercase hex', () => {
      const upperHex = 'A'.repeat(64);
      expect(() => validateSecrets({ envSecret: upperHex, authSecret: VALID_AUTH_SECRET })).toThrow(
        ConfigurationError,
      );
    });

    it('throws with descriptive message', () => {
      expect(() => validateSecrets({ envSecret: 'bad', authSecret: VALID_AUTH_SECRET })).toThrow(
        'envSecret must be a 64-character hex string',
      );
    });
  });
});
