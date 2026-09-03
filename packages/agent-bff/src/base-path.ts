import { ConfigurationError } from './errors';

const SHAPE = /^(\/[A-Za-z0-9_-]+)+$/;

/**
 * The prefix is interpolated raw into everything the BFF emits — the docs page's absolute paths and
 * the OpenAPI `servers` entry — so it is normalized once, here, before anything reads it. The two
 * inputs that hurt are the ones that still look right:
 *
 * - `'/'` would emit `//agent/openapi.json`, an RFC 3986 network-path reference: a browser resolves
 *   `agent` as a HOST, so the page loads neither its document nor its bundle.
 * - `'bff'` would emit a RELATIVE `servers` url, which a generator resolves against wherever it read
 *   the document from rather than against the origin — the page and the generated client then
 *   disagree silently.
 *
 * Anything that is not a plain path prefix is rejected rather than repaired: the value comes from the
 * embedding host, usually an environment variable, and a mount the host does not serve is a
 * misconfiguration to report, not a url to publish.
 */
export default function normalizeBasePath(input?: string): string {
  if (!input) return '';

  const trimmed = input.trim();

  if (trimmed === '' || trimmed === '/') return '';

  const collapsed = `/${trimmed}`.replace(/\/+/g, '/').replace(/\/+$/, '');

  if (!SHAPE.test(collapsed)) {
    throw new ConfigurationError(
      `Invalid BFF base path "${input}": use a plain path prefix like "/bff" ` +
        `(letters, digits, "-" and "_" only).`,
    );
  }

  return collapsed;
}

/**
 * What the caller actually asked for, as a prefix, rather than what the deployment was configured
 * with. A host that serves the BFF under a sub-path of its own — `app.use('/api', sub)` — strips
 * that sub-path before the request lands here, so the configured value is only half the truth and
 * every absolute path the BFF emits would miss it.
 *
 * The host preserves the untouched url on the request (`originalUrl`, the convention Express and
 * Connect already follow), so the prefix is the difference between it and what this app was handed.
 * Suffix removal rather than concatenation: the untouched url already contains the configured
 * prefix, and re-appending it would emit `/api/bff/bff`.
 *
 * Falls back to the configured value whenever the two cannot be related — a standalone deployment
 * has no `originalUrl` at all, and a host that rewrote the path beyond a prefix is not something to
 * guess at.
 */
export function resolveEmittedBase(
  untouchedUrl: string | undefined,
  seenUrl: string,
  configured: string,
): string {
  if (typeof untouchedUrl !== 'string' || !untouchedUrl.endsWith(seenUrl)) return configured;

  const prefix = untouchedUrl.slice(0, untouchedUrl.length - seenUrl.length);

  return prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
}

/**
 * Same thing, read off a Koa context. Defensive on purpose: a caller exercising a middleware with a
 * hand-built context has no `req` at all, and an emitted path is never worth throwing over.
 */
export function emittedBaseOf(
  ctx: { req?: unknown; originalUrl?: string; url?: string },
  configured: string,
): string {
  const untouched = (ctx.req as { originalUrl?: string } | undefined)?.originalUrl;

  return resolveEmittedBase(untouched, ctx.originalUrl ?? ctx.url ?? '', configured);
}
