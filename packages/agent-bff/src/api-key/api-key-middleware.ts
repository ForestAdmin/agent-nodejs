import type { ApiKeyAuthenticator, AuthenticatedApiKey } from './api-key-authenticator';
import type { Logger } from '../ports/logger-port';
import type { Middleware } from 'koa';

import { fingerprintApiKey } from './api-key';
import { ApiKeyError } from './api-key-error';

export const BFF_KEY_HEADER = 'X-Forest-Bff-Key';

export interface ApiKeyMiddlewareOptions {
  authenticator: ApiKeyAuthenticator;
  logger: Logger;
}

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

    ctx.state.agentToken = authenticated.agentToken;
    ctx.state.apiKeyIdentity = authenticated.identity;
    ctx.set('Cache-Control', 'no-store');
    logger('Info', 'Resolved BFF API key', {
      keyHash: fingerprintApiKey(rawKey),
      renderingId: authenticated.identity.renderingId,
    });

    await next();
  };
}
