import type { ApiKeyAuthenticator, AuthenticatedApiKey } from './api-key-authenticator';
import type { Logger } from '../ports/logger-port';
import type { Context, Middleware } from 'koa';

import { fingerprintApiKey } from './api-key';
import { ApiKeyError, toErrorBody } from './api-key-error';

export const BFF_KEY_HEADER = 'X-Forest-Bff-Key';

export interface ApiKeyMiddlewareOptions {
  authenticator: ApiKeyAuthenticator;
  logger: Logger;
}

function writeError(ctx: Context, error: unknown, rawKey: string, logger: Logger): void {
  if (error instanceof ApiKeyError) {
    if (error.retryAfter !== undefined) ctx.set('Retry-After', String(error.retryAfter));
    ctx.status = error.status;
    ctx.body = toErrorBody(error);
    logger('Warn', 'BFF API key rejected', {
      keyHash: fingerprintApiKey(rawKey),
      type: error.type,
    });

    return;
  }

  logger('Error', 'BFF API key middleware failure', {
    keyHash: fingerprintApiKey(rawKey),
    cause: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
  ctx.status = 500;
  ctx.body = { error: { type: 'server_error', status: 500, message: 'API key processing failed' } };
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
      writeError(ctx, error, rawKey, logger);

      return;
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
