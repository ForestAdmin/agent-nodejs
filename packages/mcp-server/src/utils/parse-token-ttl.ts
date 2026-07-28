import type { TokenTtlOptions } from './token-ttl';

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
