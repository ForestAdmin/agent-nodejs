import type { ResolvedApiKeyIdentity } from '../../src/api-key/api-key-client';
import type ApiKeyClient from '../../src/api-key/api-key-client';

import { issueAgentToken } from '../../src/api-key/agent-token';
import createApiKeyAuthenticator from '../../src/api-key/api-key-authenticator';
import { ApiKeyResolveError } from '../../src/api-key/api-key-client';
import createResolveCache from '../../src/api-key/resolve-cache';

jest.mock('../../src/api-key/agent-token', () => ({
  AGENT_TOKEN_EXPIRES_IN: '5m',
  issueAgentToken: jest.fn(() => 'minted-token'),
}));

const mintMock = issueAgentToken as jest.Mock;

const AUTH_SECRET = 'auth-secret';
const KEY_ID = 'a'.repeat(16);
const SECRET = 'b'.repeat(64);
const RAW = `fgw_${KEY_ID}_${SECRET}`;

const IDENTITY: ResolvedApiKeyIdentity = {
  user: {
    id: 42,
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    team: 'Support',
    tags: [{ key: 'region', value: 'eu' }],
    permissionLevel: 'admin',
  },
  renderingId: 17,
  allowedOrigins: [],
};

function buildAuthenticator(resolve: jest.Mock, nowRef: { ms: number }) {
  const client = { resolveApiKey: resolve } as unknown as ApiKeyClient;
  const cache = createResolveCache({ now: () => nowRef.ms });

  return createApiKeyAuthenticator({ client, cache, authSecret: AUTH_SECRET });
}

describe('api key authenticator', () => {
  const nowRef = { ms: 1_000_000 };

  beforeEach(() => {
    nowRef.ms = 1_000_000;
    mintMock.mockClear();
  });

  describe('invalidation', () => {
    it('should resolve the key again on the next request', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);
      await authenticator.authenticate(RAW);

      authenticator.invalidate(RAW);
      await authenticator.authenticate(RAW);

      expect(resolve).toHaveBeenCalledTimes(2);
    });

    it('should keep serving another key from the cache', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);
      const otherKey = `fgw_${'c'.repeat(16)}_${'d'.repeat(64)}`;
      await authenticator.authenticate(RAW);
      await authenticator.authenticate(otherKey);

      authenticator.invalidate(RAW);
      await authenticator.authenticate(otherKey);

      expect(resolve).toHaveBeenCalledTimes(2);
    });

    it('should ignore a key it could never have cached', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);
      await authenticator.authenticate(RAW);

      authenticator.invalidate('not-a-key');
      await authenticator.authenticate(RAW);

      expect(resolve).toHaveBeenCalledTimes(1);
    });
  });

  describe('valid key', () => {
    it('should resolve the key and mint an agent token from the identity', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);

      const result = await authenticator.authenticate(RAW);

      expect(result).toEqual({ agentToken: 'minted-token', identity: IDENTITY });
      expect(mintMock).toHaveBeenCalledWith({ identity: IDENTITY, authSecret: AUTH_SECRET });
    });

    it.each([
      ['fgw_', `fgw_${KEY_ID}_${SECRET}`],
      ['fbff_', `fbff_${KEY_ID}_${SECRET}`],
    ])('should resolve a %s key with its keyId and secret', async (_prefix, raw) => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);

      const result = await authenticator.authenticate(raw);

      expect(resolve).toHaveBeenCalledWith({ keyId: KEY_ID, secret: SECRET });
      expect(result).toEqual({ agentToken: 'minted-token', identity: IDENTITY });
    });

    it('should serve the same key from cache whichever prefix it comes with', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);

      await authenticator.authenticate(`fbff_${KEY_ID}_${SECRET}`);
      await authenticator.authenticate(`fgw_${KEY_ID}_${SECRET}`);

      expect(resolve).toHaveBeenCalledTimes(1);
    });

    it('should serve from cache without re-calling the SaaS within 60s', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);

      await authenticator.authenticate(RAW);
      nowRef.ms += 59_000;
      await authenticator.authenticate(RAW);

      expect(resolve).toHaveBeenCalledTimes(1);
    });

    it('should re-resolve after the 60s positive window', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);

      await authenticator.authenticate(RAW);
      nowRef.ms += 60_000;
      await authenticator.authenticate(RAW);

      expect(resolve).toHaveBeenCalledTimes(2);
    });

    it('should mint a fresh token on every request even on a cache hit', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);

      await authenticator.authenticate(RAW);
      await authenticator.authenticate(RAW);

      expect(resolve).toHaveBeenCalledTimes(1);
      expect(mintMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('malformed key', () => {
    it('should reject with invalid_api_key without calling the SaaS', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);

      await expect(authenticator.authenticate('not-a-key')).rejects.toMatchObject({
        type: 'invalid_api_key',
        status: 401,
      });
      expect(resolve).not.toHaveBeenCalled();
      expect(mintMock).not.toHaveBeenCalled();
    });

    it('should reject a well-formed key with an unknown prefix without calling the SaaS', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);

      await expect(authenticator.authenticate(`fbf_${KEY_ID}_${SECRET}`)).rejects.toMatchObject({
        type: 'invalid_api_key',
        status: 401,
      });
      expect(resolve).not.toHaveBeenCalled();
    });
  });

  describe('invalid / revoked / expired / wrong-environment key', () => {
    it('should map a SaaS 401 to invalid_api_key and negatively cache it', async () => {
      const resolve = jest.fn(async () => {
        throw new ApiKeyResolveError({ status: 401 });
      });
      const authenticator = buildAuthenticator(resolve, nowRef);

      await expect(authenticator.authenticate(RAW)).rejects.toMatchObject({
        type: 'invalid_api_key',
        status: 401,
      });

      nowRef.ms += 9_000;
      await expect(authenticator.authenticate(RAW)).rejects.toMatchObject({
        type: 'invalid_api_key',
      });
      expect(resolve).toHaveBeenCalledTimes(1);
    });
  });

  describe('right keyId with wrong secret', () => {
    it('should not hit the positive cache entry of a previously valid key', async () => {
      const resolve = jest.fn(async () => IDENTITY);
      const authenticator = buildAuthenticator(resolve, nowRef);
      const wrongSecretKey = `fgw_${KEY_ID}_${'c'.repeat(64)}`;

      await authenticator.authenticate(RAW);
      await authenticator.authenticate(wrongSecretKey);

      expect(resolve).toHaveBeenCalledTimes(2);
      expect(resolve).toHaveBeenLastCalledWith({ keyId: KEY_ID, secret: 'c'.repeat(64) });
    });
  });

  describe('user lost rendering access', () => {
    it('should map a SaaS 403 to forest_identity_not_allowed and negatively cache it', async () => {
      const resolve = jest.fn(async () => {
        throw new ApiKeyResolveError({ status: 403 });
      });
      const authenticator = buildAuthenticator(resolve, nowRef);

      await expect(authenticator.authenticate(RAW)).rejects.toMatchObject({
        type: 'forest_identity_not_allowed',
        status: 403,
      });

      nowRef.ms += 9_000;
      await expect(authenticator.authenticate(RAW)).rejects.toMatchObject({
        type: 'forest_identity_not_allowed',
      });
      expect(resolve).toHaveBeenCalledTimes(1);
    });
  });

  describe('plan without the Gateway API', () => {
    it('should map a SaaS 403 plan_feature_missing to its own error and negatively cache it', async () => {
      const resolve = jest.fn(async () => {
        throw new ApiKeyResolveError({ status: 403, code: 'plan_feature_missing' });
      });
      const authenticator = buildAuthenticator(resolve, nowRef);

      const error = await authenticator.authenticate(RAW).catch((caught: unknown) => caught);

      expect(error).toMatchObject({
        type: 'plan_feature_missing',
        status: 403,
        message: "The project's plan does not include the Gateway API.",
        retryAfter: undefined,
      });

      nowRef.ms += 9_000;
      await expect(authenticator.authenticate(RAW)).rejects.toMatchObject({
        type: 'plan_feature_missing',
      });
      expect(resolve).toHaveBeenCalledTimes(1);
    });

    it('should keep mapping any other SaaS 403 code to forest_identity_not_allowed', async () => {
      const resolve = jest.fn(async () => {
        throw new ApiKeyResolveError({ status: 403, code: 'forest_identity_not_allowed' });
      });
      const authenticator = buildAuthenticator(resolve, nowRef);

      await expect(authenticator.authenticate(RAW)).rejects.toMatchObject({
        type: 'forest_identity_not_allowed',
        status: 403,
      });
    });
  });

  describe('SaaS unavailable', () => {
    it('should map an unreachable resolver to a non-cached 503 with Retry-After 5', async () => {
      const resolve = jest.fn(async () => {
        throw new ApiKeyResolveError({ unreachable: true });
      });
      const authenticator = buildAuthenticator(resolve, nowRef);

      await expect(authenticator.authenticate(RAW)).rejects.toMatchObject({
        type: 'key_resolution_unavailable',
        status: 503,
        retryAfter: 5,
      });

      await authenticator.authenticate(RAW).catch(() => undefined);
      expect(resolve).toHaveBeenCalledTimes(2);
    });
  });

  describe('SaaS rate-limited', () => {
    it('should map a SaaS 429 to a non-cached 503 propagating Retry-After', async () => {
      const resolve = jest.fn(async () => {
        throw new ApiKeyResolveError({ status: 429, retryAfter: 12 });
      });
      const authenticator = buildAuthenticator(resolve, nowRef);

      await expect(authenticator.authenticate(RAW)).rejects.toMatchObject({
        type: 'key_resolution_unavailable',
        status: 503,
        retryAfter: 12,
      });

      await authenticator.authenticate(RAW).catch(() => undefined);
      expect(resolve).toHaveBeenCalledTimes(2);
    });
  });

  describe('malformed BFF call (SaaS 400)', () => {
    it('should map a SaaS 400 to invalid_request without negatively caching it', async () => {
      const resolve = jest.fn(async () => {
        throw new ApiKeyResolveError({ status: 400 });
      });
      const authenticator = buildAuthenticator(resolve, nowRef);

      await expect(authenticator.authenticate(RAW)).rejects.toMatchObject({
        type: 'invalid_request',
        status: 400,
      });

      await authenticator.authenticate(RAW).catch(() => undefined);
      expect(resolve).toHaveBeenCalledTimes(2);
    });
  });

  describe('unexpected SaaS status', () => {
    it('should map an out-of-taxonomy status to a non-cached 503', async () => {
      const resolve = jest.fn(async () => {
        throw new ApiKeyResolveError({ status: 500 });
      });
      const authenticator = buildAuthenticator(resolve, nowRef);

      await expect(authenticator.authenticate(RAW)).rejects.toMatchObject({
        type: 'key_resolution_unavailable',
        status: 503,
        retryAfter: 5,
      });

      await authenticator.authenticate(RAW).catch(() => undefined);
      expect(resolve).toHaveBeenCalledTimes(2);
    });
  });

  describe('non-resolver error', () => {
    it('should rethrow an error that is not an ApiKeyResolveError unchanged', async () => {
      const boom = new Error('unexpected');
      const resolve = jest.fn(async () => {
        throw boom;
      });
      const authenticator = buildAuthenticator(resolve, nowRef);

      await expect(authenticator.authenticate(RAW)).rejects.toBe(boom);
    });
  });
});
