import type { ResolvedApiKeyIdentity } from '../api-key/api-key-client';
import type { Logger } from '../ports/logger-port';
import type { Middleware } from 'koa';

import { originAllowed } from './origin';
import { fingerprintApiKey } from '../api-key/api-key';
import { BFF_KEY_HEADER } from '../api-key/api-key-middleware';
import { originNotAllowed } from '../http/bff-http-error';

export interface PerKeyOriginMiddlewareOptions {
  logger: Logger;
}

export default function createPerKeyOriginMiddleware({
  logger,
}: PerKeyOriginMiddlewareOptions): Middleware {
  return async function perKeyOriginMiddleware(ctx, next) {
    const origin = ctx.get('Origin');
    const identity = ctx.state.apiKeyIdentity as ResolvedApiKeyIdentity | undefined;
    const allowedOrigins = identity?.allowedOrigins ?? [];

    if (identity && allowedOrigins.length > 0 && !originAllowed(origin, allowedOrigins)) {
      logger('Warn', 'BFF per-key origin rejected', {
        origin,
        path: ctx.path,
        keyHash: fingerprintApiKey(ctx.get(BFF_KEY_HEADER)),
        renderingId: identity.renderingId,
      });

      throw originNotAllowed();
    }

    await next();
  };
}
