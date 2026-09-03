import type { ResolvedApiKeyIdentity } from '../api-key/api-key-client';
import type { Logger } from '../ports/logger-port';
import type { Middleware } from 'koa';

import { loggableOrigin, originAllowed } from './origin';
import { fingerprintApiKey } from '../api-key/api-key';
import { BFF_KEY_HEADER } from '../api-key/api-key-middleware';
import { originNotAllowed } from '../http/bff-http-error';

export interface PerKeyOriginMiddlewareOptions {
  logger: Logger;
  serverAllowedOrigins: string[];
}

// A key whose allowedOrigins share nothing with BFF_ALLOWED_ORIGINS can never serve a browser: this
// middleware lets the request through, the server-level CORS layer omits Access-Control-Allow-Origin,
// and the browser drops a response the BFF answered normally — no rejection anywhere, no trace. The
// misconfiguration belongs to the key, not to the request, so it is reported once per key rather
// than once per request; the cap keeps the seen set bounded on a rotating key population.
const MAX_ASSESSED_KEYS = 1000;

export default function createPerKeyOriginMiddleware({
  logger,
  serverAllowedOrigins,
}: PerKeyOriginMiddlewareOptions): Middleware {
  const assessedKeys = new Set<string>();

  function reportOriginsThatCanNeverPass(allowedOrigins: string[], keyHash: string): void {
    if (serverAllowedOrigins.length === 0 || assessedKeys.has(keyHash)) return;

    const canNeverPass = !allowedOrigins.some(entry => originAllowed(entry, serverAllowedOrigins));
    if (assessedKeys.size >= MAX_ASSESSED_KEYS) assessedKeys.clear();
    assessedKeys.add(keyHash);

    if (canNeverPass) {
      logger('Warn', 'BFF key origins are all outside BFF_ALLOWED_ORIGINS', {
        keyHash,
        keyOrigins: allowedOrigins.map(loggableOrigin),
      });
    }
  }

  return async function perKeyOriginMiddleware(ctx, next) {
    const origin = ctx.get('Origin');
    const identity = ctx.state.apiKeyIdentity as ResolvedApiKeyIdentity | undefined;
    const allowedOrigins = identity?.allowedOrigins ?? [];

    if (!identity || allowedOrigins.length === 0) {
      await next();

      return;
    }

    const keyHash = fingerprintApiKey(ctx.get(BFF_KEY_HEADER));
    reportOriginsThatCanNeverPass(allowedOrigins, keyHash);

    if (!originAllowed(origin, allowedOrigins)) {
      logger('Warn', 'BFF per-key origin rejected', {
        origin: loggableOrigin(origin),
        path: ctx.path,
        keyHash,
        renderingId: identity.renderingId,
      });

      throw originNotAllowed();
    }

    await next();
  };
}
