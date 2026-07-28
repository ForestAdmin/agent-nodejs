import type { TokenTtlOptions } from './token-ttl';

// Coercion only — normalizeTokenTtl owns validation, so a bad env var and a bad embedded option
// fail with the same message. `Number('abc')` yields NaN, which it rejects.
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
