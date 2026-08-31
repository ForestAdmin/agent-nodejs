import type { Logger } from '../ports/logger-port';
import type { Middleware } from 'koa';

import { originAllowed } from './origin';
import { originNotAllowed } from '../http/bff-http-error';

export interface PerKeyOriginMiddlewareOptions {
  logger: Logger;
}

export default function createPerKeyOriginMiddleware({
  logger,
}: PerKeyOriginMiddlewareOptions): Middleware {
  return async function perKeyOriginMiddleware(ctx, next) {
    const origin = ctx.get('Origin');
    const identity = ctx.state.apiKeyIdentity as
      | { allowedOrigins?: string[]; renderingId?: number }
      | undefined;
    const allowedOrigins = identity?.allowedOrigins ?? [];

    if (allowedOrigins.length > 0 && !originAllowed(origin, allowedOrigins)) {
      logger('Warn', 'BFF per-key origin rejected', {
        origin,
        path: ctx.path,
        renderingId: identity?.renderingId,
      });

      throw originNotAllowed();
    }

    await next();
  };
}
