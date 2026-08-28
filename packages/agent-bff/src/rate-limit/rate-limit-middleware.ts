import type { Middleware } from 'koa';

import isAgentPath from './agent-path';
import { tooManyRequests } from '../http/bff-local-errors';

export interface RateLimitMiddlewareOptions {
  /** Milliseconds of the fixed window. */
  windowMs: number;
  /** Requests allowed per identity per window. */
  maxRequests: number;
  /** Clock, injectable for tests. Defaults to `Date.now`. */
  now?: () => number;
  /** Maximum number of live identity buckets; a new identity beyond it fails closed. */
  maxEntries?: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;

interface AuthEdgeState {
  apiKeyIdentity?: { user: { id: number }; renderingId: number };
  principal?: { id: number; rendering_id: string };
}

// One bucket per authenticated identity, mode-prefixed so an API key and an OAuth session can
// never share a budget even at identical numeric ids. Anonymous requests have no bucket: they
// already answered 401 upstream of the limiter, and bucketing them would let unauthenticated
// traffic allocate memory.
function bucketKeyOf(state: AuthEdgeState): string | undefined {
  const { apiKeyIdentity, principal } = state;

  if (apiKeyIdentity) return `api-key:${apiKeyIdentity.renderingId}:${apiKeyIdentity.user.id}`;
  if (principal) return `oauth:${principal.rendering_id}:${principal.id}`;

  return undefined;
}

/**
 * Fixed-window per-identity rate limiter for the `/agent` edge: `maxRequests` per `windowMs`,
 * counting every authenticated agent request, 429 `too_many_requests` beyond it.
 *
 * The counter increments synchronously before the downstream chain runs, so concurrent bursts
 * cannot all slip past a shared `await`. At the `maxEntries` ceiling a NEW identity fails closed
 * rather than evicting a live window: a limiter must not silently reset someone's quota. This is
 * an in-process guard like the session store: one deployment, one window, no cross-instance
 * coordination; restarts clear the counters.
 */
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

    if (key === undefined) {
      await next();

      return;
    }

    const current = now();
    let entry = buckets.get(key);

    if (entry && current >= entry.resetAt) {
      buckets.delete(key);
      entry = undefined;
    }

    if (entry === undefined) {
      purgeExpired(current);

      if (buckets.size >= maxEntries) {
        // Truthful delay: the table holds only live windows at this point (purge ran), so the
        // earliest reset among them is when a slot frees for this identity.
        const earliestReset = Math.min(...[...buckets.values()].map(live => live.resetAt));
        const retryAfter = Math.max(1, Math.ceil((earliestReset - current) / 1000));

        throw tooManyRequests(retryAfter, 'Too many requests: the rate limiter is saturated');
      }

      entry = { count: 0, resetAt: current + windowMs };
      buckets.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - current) / 1000));

      throw tooManyRequests(
        retryAfter,
        `Too many requests: the limit is ${maxRequests} per ${Math.round(
          windowMs / 1000,
        )}s per identity`,
      );
    }

    await next();
  };
}
