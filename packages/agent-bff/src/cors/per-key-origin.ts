import type { Middleware } from 'koa';

import { hasOrigin, originAllowed } from './origin';
import { originNotAllowed } from '../http/bff-http-error';

export default function createPerKeyOriginMiddleware(): Middleware {
  return async function perKeyOriginMiddleware(ctx, next) {
    const identity = ctx.state.apiKeyIdentity as { allowedOrigins?: string[] } | undefined;
    const allowedOrigins = identity?.allowedOrigins ?? [];
    const origin = ctx.get('Origin');

    if (allowedOrigins.length > 0 && hasOrigin(origin) && !originAllowed(origin, allowedOrigins)) {
      throw originNotAllowed();
    }

    await next();
  };
}
