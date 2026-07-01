import type { Middleware } from 'koa';

import { originAllowed } from './origin';

export const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
export const ALLOWED_HEADERS =
  'Authorization, Content-Type, X-Forest-Timezone, X-Forest-Bff-Key, X-Request-Id';
export const PREFLIGHT_MAX_AGE_SECONDS = 600;

export interface CorsMiddlewareOptions {
  allowedOrigins: string[];
}

export default function createCorsMiddleware({
  allowedOrigins,
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
      }

      ctx.status = 204;

      return;
    }

    await next();
  };
}
