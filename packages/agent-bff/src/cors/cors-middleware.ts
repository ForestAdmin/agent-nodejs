import type { Logger } from '../ports/logger-port';
import type { Middleware } from 'koa';

import { loggableOrigin, originAllowed } from './origin';

export const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
export const ALLOWED_HEADERS =
  'Authorization, Content-Type, X-Forest-Timezone, X-Forest-Bff-Key, X-Request-Id, Forest-Projection';
export const PREFLIGHT_MAX_AGE_SECONDS = 600;

export interface CorsMiddlewareOptions {
  allowedOrigins: string[];
  logger: Logger;
}

export default function createCorsMiddleware({
  allowedOrigins,
  logger,
}: CorsMiddlewareOptions): Middleware {
  return async function corsMiddleware(ctx, next) {
    const origin = ctx.get('Origin');

    if (origin) ctx.vary('Origin');

    const allowed = origin ? originAllowed(origin, allowedOrigins) : false;

    if (allowed) ctx.set('Access-Control-Allow-Origin', origin);

    if (ctx.method === 'OPTIONS') {
      if (allowed) {
        ctx.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
        ctx.set('Access-Control-Allow-Headers', ALLOWED_HEADERS);
        ctx.set('Access-Control-Max-Age', String(PREFLIGHT_MAX_AGE_SECONDS));
      } else if (origin && ctx.get('Access-Control-Request-Method')) {
        logger('Warn', 'BFF preflight origin rejected', {
          origin: loggableOrigin(origin),
          path: ctx.path,
        });
      }

      ctx.status = 204;

      return;
    }

    await next();
  };
}
