import type { ResolvedApiKeyIdentity } from '../api-key/api-key-client';
import type { Logger } from '../ports/logger-port';
import type { Middleware } from 'koa';

import { loggableOrigin, originAllowed } from './origin';
import { fingerprintApiKey } from '../api-key/api-key';
import { BFF_KEY_HEADER } from '../api-key/api-key-middleware';
import { originNotAllowed } from '../http/bff-http-error';

export interface PerKeyOriginMiddlewareOptions {
  logger: Logger;
  serverAllowedOrigins?: string[];
}

// A key whose allowedOrigins share nothing with BFF_ALLOWED_ORIGINS can never serve a browser: this
// middleware lets the request through, the server-level CORS layer omits Access-Control-Allow-Origin,
// and the browser drops a response the BFF answered normally — no rejection anywhere, no trace. The
// misconfiguration belongs to the key, not to the request, so it is reported once per key rather
// than once per request; the cap keeps the seen set bounded on a rotating key population.
const MAX_REPORTED_KEYS = 1000;

export default function createPerKeyOriginMiddleware({
  logger,
  serverAllowedOrigins = [],
}: PerKeyOriginMiddlewareOptions): Middleware {
  const reportedKeys = new Set<string>();

  function reportOriginsThatCanNeverPass(allowedOrigins: string[], keyHash: string): void {
    if (serverAllowedOrigins.length === 0) return;
    if (allowedOrigins.some(entry => originAllowed(entry, serverAllowedOrigins))) return;
    if (reportedKeys.has(keyHash)) return;

    if (reportedKeys.size >= MAX_REPORTED_KEYS) reportedKeys.clear();
    reportedKeys.add(keyHash);

    logger('Warn', 'BFF key origins are all outside BFF_ALLOWED_ORIGINS', {
      keyHash,
      keyOrigins: allowedOrigins.map(loggableOrigin),
    });
  }

  return async function perKeyOriginMiddleware(ctx, next) {
    const origin = ctx.get('Origin');
    const identity = ctx.state.apiKeyIdentity as ResolvedApiKeyIdentity | undefined;
    const allowedOrigins = identity?.allowedOrigins ?? [];

    if (identity && allowedOrigins.length > 0) {
      reportOriginsThatCanNeverPass(allowedOrigins, fingerprintApiKey(ctx.get(BFF_KEY_HEADER)));
    }

    if (identity && allowedOrigins.length > 0 && !originAllowed(origin, allowedOrigins)) {
      logger('Warn', 'BFF per-key origin rejected', {
        origin: loggableOrigin(origin),
        path: ctx.path,
        keyHash: fingerprintApiKey(ctx.get(BFF_KEY_HEADER)),
        renderingId: identity.renderingId,
      });

      throw originNotAllowed();
    }

    await next();
  };
}
