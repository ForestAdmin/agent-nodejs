import type { ApiKeyAuthenticator, AuthenticatedApiKey } from './api-key-authenticator';
import type { Logger } from '../ports/logger-port';
import type { Context, Middleware } from 'koa';

import { fingerprintApiKey } from './api-key';
import { ApiKeyError } from './api-key-error';

export const BFF_KEY_HEADER = 'X-Forest-Bff-Key';

export type ApiKeyIdentityInvalidator = () => void;

export interface ApiKeyMiddlewareOptions {
  authenticator: ApiKeyAuthenticator;
  logger: Logger;
}

// On authentication failure this middleware rethrows `ApiKeyError` rather than
// writing the response itself; it must be mounted behind an error middleware
// that serializes the structured body (see `createErrorMiddleware`).
export default function createApiKeyMiddleware({
  authenticator,
  logger,
}: ApiKeyMiddlewareOptions): Middleware {
  return async function apiKeyMiddleware(ctx, next) {
    const rawKey = ctx.get(BFF_KEY_HEADER);

    if (!rawKey) {
      await next();

      return;
    }

    let authenticated: AuthenticatedApiKey;

    try {
      authenticated = await authenticator.authenticate(rawKey);
    } catch (error) {
      if (error instanceof ApiKeyError) {
        logger('Warn', 'BFF API key rejected', {
          keyHash: fingerprintApiKey(rawKey),
          type: error.type,
        });
      } else {
        logger('Error', 'BFF API key middleware failure', {
          keyHash: fingerprintApiKey(rawKey),
          cause: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        });
      }

      throw error;
    }

    const invalidateIdentity: ApiKeyIdentityInvalidator = () => authenticator.invalidate(rawKey);

    ctx.state.invalidateApiKeyIdentity = invalidateIdentity;
    ctx.state.agentToken = authenticated.agentToken;
    ctx.state.apiKeyIdentity = authenticated.identity;
    ctx.state.forestServerToken = authenticated.forestServerToken;
    ctx.set('Cache-Control', 'no-store');
    logger('Info', 'Resolved BFF API key', {
      keyHash: fingerprintApiKey(rawKey),
      renderingId: authenticated.identity.renderingId,
    });

    await next();
  };
}

/**
 * Forgets the identity this request was authenticated with. Called when the Forest server refuses
 * the token that came with it: the token is cached with the identity, so the next request must
 * resolve the key again instead of replaying the refused one for the rest of the cache window.
 *
 * A no-op outside api-key mode — nothing else lands an invalidator.
 */
export function invalidateApiKeyIdentity(ctx: Context): void {
  const invalidate = ctx.state.invalidateApiKeyIdentity as ApiKeyIdentityInvalidator | undefined;

  invalidate?.();
}
