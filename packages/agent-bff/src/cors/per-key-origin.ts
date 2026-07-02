import type { Middleware } from 'koa';

import { originAllowed } from './origin';
import { originNotAllowed } from '../http/bff-http-error';

export default function createPerKeyOriginMiddleware(): Middleware {
  return async function perKeyOriginMiddleware(ctx, next) {
    const identity = ctx.state.apiKeyIdentity as { allowedOrigins?: string[] } | undefined;
    const allowedOrigins = identity?.allowedOrigins ?? [];

    if (allowedOrigins.length > 0 && !originAllowed(ctx.get('Origin'), allowedOrigins)) {
      throw originNotAllowed();
    }

    await next();
  };
}
