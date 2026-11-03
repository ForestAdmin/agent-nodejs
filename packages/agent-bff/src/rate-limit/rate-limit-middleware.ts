import type { FixedWindowLimiterOptions } from './fixed-window-limiter';
import type { ResolvedApiKeyIdentity } from '../api-key/api-key-client';
import type { BffAccessTokenPayload } from '../oauth/bff-token';
import type { Middleware } from 'koa';

import isAgentPath from './agent-path';
import createFixedWindowLimiter from './fixed-window-limiter';
import { unauthorized } from '../http/bff-http-error';
import { RATE_LIMIT_CAUSES, tooManyRequests } from '../http/bff-local-errors';

export type RateLimitMiddlewareOptions = FixedWindowLimiterOptions;

const MS_PER_SECOND = 1000;

interface AuthEdgeState {
  apiKeyIdentity?: ResolvedApiKeyIdentity;
  principal?: BffAccessTokenPayload;
}

function bucketKeyOf(state: AuthEdgeState): string | undefined {
  const { apiKeyIdentity, principal } = state;

  if (apiKeyIdentity) return `api-key:${apiKeyIdentity.renderingId}:${apiKeyIdentity.user.id}`;
  if (principal) return `oauth:${principal.rendering_id}:${principal.id}`;

  return undefined;
}

export default function createRateLimitMiddleware(options: RateLimitMiddlewareOptions): Middleware {
  const { windowMs, maxRequests } = options;
  const limiter = createFixedWindowLimiter(options);

  return async function rateLimitMiddleware(ctx, next) {
    if (!isAgentPath(ctx.path)) {
      await next();

      return;
    }

    const key = bucketKeyOf(ctx.state as AuthEdgeState);

    if (key === undefined) throw unauthorized('No caller identity for this request');

    const refusal = limiter.hit(key);

    if (refusal?.saturated) {
      throw tooManyRequests(
        refusal.retryAfterSeconds,
        'Too many requests: the rate limiter is saturated',
        RATE_LIMIT_CAUSES.limiterSaturated,
      );
    }

    if (refusal) {
      throw tooManyRequests(
        refusal.retryAfterSeconds,
        `Too many requests: the limit is ${maxRequests} per ${Math.round(
          windowMs / MS_PER_SECOND,
        )}s per identity`,
        RATE_LIMIT_CAUSES.limitExceeded,
      );
    }

    await next();
  };
}
