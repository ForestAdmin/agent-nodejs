import type { ResolvedApiKeyIdentity } from '../api-key/api-key-client';
import type { BffAccessTokenPayload } from '../oauth/bff-token';
import type { Middleware } from 'koa';

import isAgentPath from './agent-path';
import { unauthorized } from '../http/bff-http-error';
import { tooManyRequests } from '../http/bff-local-errors';

export interface RateLimitMiddlewareOptions {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
  maxEntries?: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;

const MS_PER_SECOND = 1000;

function retryAfterSeconds(resetAt: number, current: number): number {
  return Math.max(1, Math.ceil((resetAt - current) / MS_PER_SECOND));
}

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

export default function createRateLimitMiddleware({
  windowMs,
  maxRequests,
  now = Date.now,
  maxEntries = DEFAULT_MAX_ENTRIES,
}: RateLimitMiddlewareOptions): Middleware {
  const buckets = new Map<string, WindowEntry>();

  function purgeExpired(current: number): void {
    for (const [key, entry] of buckets) {
      if (current >= entry.resetAt) buckets.delete(key);
    }
  }

  return async function rateLimitMiddleware(ctx, next) {
    if (!isAgentPath(ctx.path)) {
      await next();

      return;
    }

    const key = bucketKeyOf(ctx.state as AuthEdgeState);

    if (key === undefined) throw unauthorized('No caller identity for this request');

    const current = now();
    let entry = buckets.get(key);

    if (entry && current >= entry.resetAt) {
      buckets.delete(key);
      entry = undefined;
    }

    if (entry === undefined) {
      purgeExpired(current);

      if (buckets.size >= maxEntries) {
        const earliestReset = Math.min(...[...buckets.values()].map(live => live.resetAt));

        throw tooManyRequests(
          retryAfterSeconds(earliestReset, current),
          'Too many requests: the rate limiter is saturated',
          { cause: 'limiter_saturated' },
        );
      }

      entry = { count: 0, resetAt: current + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      throw tooManyRequests(
        retryAfterSeconds(entry.resetAt, current),
        `Too many requests: the limit is ${maxRequests} per ${Math.round(
          windowMs / MS_PER_SECOND,
        )}s per identity`,
        { cause: 'limit_exceeded' },
      );
    }

    await next();
  };
}
