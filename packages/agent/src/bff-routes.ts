/**
 * Where an embedded BFF answers, at the root of the host application. Fixed: the BFF serves its own
 * `/oauth/*` and `/docs`, which would otherwise collide with the MCP server's root paths and with
 * whatever the host already serves.
 */
export const BFF_PREFIX = '/bff';

/**
 * Matches on the pathname and on a segment boundary, so `/bff?x=1` is claimed and `/bffalo` is not.
 */
export function isBffRoute(url: string): boolean {
  const [pathname] = url.split(/[?#]/, 1);

  return pathname === BFF_PREFIX || pathname.startsWith(`${BFF_PREFIX}/`);
}

/**
 * The url the BFF itself expects: it knows nothing of the prefix the host serves it under, and its
 * routes are absolute (`/agent/v1/…`, `/health`). Never yields an empty string — Koa would read that
 * as a malformed request rather than as the root.
 */
export function stripBffPrefix(url: string): string {
  const remainder = url.slice(BFF_PREFIX.length);

  if (remainder === '') return '/';

  return remainder.startsWith('/') ? remainder : `/${remainder}`;
}
