import type { Middleware } from 'koa';

import { originAllowed } from './origin';

/**
 * Whether the caller is the very application serving this BFF. A same-origin request carries
 * `Origin` too — the Fetch spec sends it on everything but GET and HEAD, and every BFF data route
 * is a POST — so without this exemption a host serving its own UI next to a `/bff` mount would be
 * refused on every request under the default empty allow-list, for an origin it has no reason to
 * think it must name.
 *
 * Compared on host rather than on the full origin: a TLS-terminating proxy leaves `ctx.protocol` at
 * `http` while the browser reports `https`, so matching the scheme would work in development and
 * silently fail in production. The scheme is also the part a same-host attacker already controls.
 *
 * Forging the header buys nothing: a caller that can set `Origin` can simply omit it, which the
 * allow-list lets through by design. What this cannot be reached by is the cross-site request the
 * allow-list exists for — there the browser sets `Origin` to the attacking page, never to this host.
 */
function isSameOrigin(origin: string, host: string): boolean {
  if (host === '') return false;

  let url: URL;

  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  // `url.host` is already normalized by `new URL()` — lowercased, and stripped of a port that is
  // the default for the scheme — while `ctx.host` is the raw `Host` header, which a client or proxy
  // spells however it likes. Both differences have to be absorbed here, or the exemption refuses
  // the very requests it exists for: `Host: APP.EXAMPLE.COM` or `Host: app.example.com:443` against
  // `Origin: https://app.example.com`. A non-default port still has to match exactly.
  const normalizedHost = host.toLowerCase();
  const defaultPort = url.protocol === 'https:' ? '443' : '80';

  return normalizedHost === url.host || normalizedHost === `${url.host}:${defaultPort}`;
}

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
    // Nor is the host's own application, which the allow-list has nothing to say about.
    if (origin && !allowed && !isSameOrigin(origin, ctx.host)) {
      ctx.status = ORIGIN_NOT_ALLOWED.status;
      ctx.body = { error: ORIGIN_NOT_ALLOWED };

      return;
    }

    await next();
  };
}
