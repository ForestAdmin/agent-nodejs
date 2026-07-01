import type ApiKeyClient from './api-key-client';
import type { ResolvedApiKeyIdentity } from './api-key-client';
import type { ApiKeyError } from './api-key-error';
import type { ResolveCache } from './resolve-cache';

import { issueAgentToken } from './agent-token';
import { hashApiKey, parseApiKey } from './api-key';
import { ApiKeyResolveError } from './api-key-client';
import {
  forestIdentityNotAllowed,
  invalidApiKey,
  invalidRequest,
  keyResolutionUnavailable,
} from './api-key-error';

const UNAVAILABLE_RETRY_AFTER_SECONDS = 5;
const NEGATIVE_CACHE_STATUSES = new Set([401, 403]);

export interface ApiKeyAuthenticatorOptions {
  client: ApiKeyClient;
  cache: ResolveCache;
  authSecret: string;
}

export interface AuthenticatedApiKey {
  agentToken: string;
  identity: ResolvedApiKeyIdentity;
}

export interface ApiKeyAuthenticator {
  authenticate(rawKey: string): Promise<AuthenticatedApiKey>;
}

function mapResolveError(error: ApiKeyResolveError): ApiKeyError {
  if (error.unreachable) return keyResolutionUnavailable(UNAVAILABLE_RETRY_AFTER_SECONDS);

  switch (error.status) {
    case 401:
      return invalidApiKey();
    case 403:
      return forestIdentityNotAllowed();
    case 400:
      return invalidRequest();
    case 429:
      return keyResolutionUnavailable(error.retryAfter ?? UNAVAILABLE_RETRY_AFTER_SECONDS);
    default:
      return keyResolutionUnavailable(UNAVAILABLE_RETRY_AFTER_SECONDS);
  }
}

export default function createApiKeyAuthenticator({
  client,
  cache,
  authSecret,
}: ApiKeyAuthenticatorOptions): ApiKeyAuthenticator {
  function mint(identity: ResolvedApiKeyIdentity): AuthenticatedApiKey {
    return { agentToken: issueAgentToken({ identity, authSecret }), identity };
  }

  return {
    async authenticate(rawKey) {
      const parsed = parseApiKey(rawKey);

      if (!parsed) throw invalidApiKey();

      const hash = hashApiKey(parsed.keyId, parsed.secret);

      const cachedIdentity = cache.getPositive(hash);
      if (cachedIdentity) return mint(cachedIdentity);

      const cachedError = cache.getNegative(hash);
      if (cachedError) throw cachedError;

      let identity: ResolvedApiKeyIdentity;

      try {
        identity = await client.resolveApiKey(parsed);
      } catch (error) {
        if (error instanceof ApiKeyResolveError) {
          const mapped = mapResolveError(error);
          if (NEGATIVE_CACHE_STATUSES.has(mapped.status)) cache.setNegative(hash, mapped);

          throw mapped;
        }

        throw error;
      }

      const authenticated = mint(identity);
      cache.setPositive(hash, identity);

      return authenticated;
    },
  };
}
