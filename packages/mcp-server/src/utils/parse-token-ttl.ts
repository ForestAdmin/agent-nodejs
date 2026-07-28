import type { TokenTtlOptions } from './token-ttl';

// Coercion only: normalizeTokenTtl owns validation, so an env var and an embedded option fail alike.
export default function parseTokenTtl(
  accessTokenSeconds?: string,
  refreshTokenSeconds?: string,
): TokenTtlOptions | undefined {
  if (!accessTokenSeconds && !refreshTokenSeconds) return undefined;

  return {
    accessTokenSeconds: accessTokenSeconds ? Number(accessTokenSeconds) : undefined,
    refreshTokenSeconds: refreshTokenSeconds ? Number(refreshTokenSeconds) : undefined,
  };
}
