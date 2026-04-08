import { ConfigurationError } from './errors';

const ENV_SECRET_PATTERN = /^[0-9a-f]{64}$/;

export default function validateSecrets(params: { envSecret: string; authSecret: string }): void {
  if (!params.authSecret || typeof params.authSecret !== 'string') {
    throw new ConfigurationError('authSecret must be a non-empty string');
  }

  if (!ENV_SECRET_PATTERN.test(params.envSecret)) {
    throw new ConfigurationError('envSecret must be a 64-character hex string');
  }
}
