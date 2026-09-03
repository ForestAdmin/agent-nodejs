import type { Middleware } from 'koa';

import { originAllowed } from './origin';

export const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
export const ALLOWED_HEADERS =
  'Authorization, Content-Type, X-Forest-Timezone, X-Forest-Bff-Key, X-Request-Id, Forest-Projection';
export const PREFLIGHT_MAX_AGE_SECONDS = 600;

/**
 * Shaped like every other BFF error so a consumer branches on `error.type`. Built here rather than
 * thrown: this middleware runs before the agent-scoped error middleware, so a throw would surface
 * as a bare 500 instead of the contract.
 */
export const ORIGIN_NOT_ALLOWED = {
  type: 'origin_not_allowed',
  status: 403,
  message: 'This origin is not allowed to call this BFF',
} as const;

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

    // Refuse rather than run and let the browser discard the answer. Omitting the header only stops
    // the caller from READING the response: the request still executed, so a list was read and an
    // action was executed for an origin the allow-list names as unwelcome. It also stops being
    // theoretical once a host sits in front of this app — a permissive `cors()` of its own answers
    // the preflight with `*`, and the real request arrives here regardless.
    // A caller with no `Origin` at all is untouched: that is every server-to-server api-key call.
    if (origin && !allowed) {
      ctx.status = ORIGIN_NOT_ALLOWED.status;
      ctx.body = { error: ORIGIN_NOT_ALLOWED };

      return;
    }

    await next();
  };
}
