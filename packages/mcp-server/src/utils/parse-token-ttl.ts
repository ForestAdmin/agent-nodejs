import type { TokenTtlOptions } from './token-ttl';

// An env var set to an empty string is a misconfiguration, not an opt-out: the operator meant to
// cap something. Coercing it to NaN makes normalizeTokenTtl reject it instead of leaving that token
// silently uncapped — which matters most when only one of the two is empty.
function toSeconds(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;

  return Number(value.trim() === '' ? NaN : value.trim());
}

export default function parseTokenTtl({
  accessTokenSeconds,
  refreshTokenSeconds,
}: {
  accessTokenSeconds?: string;
  refreshTokenSeconds?: string;
}): TokenTtlOptions | undefined {
  if (accessTokenSeconds === undefined && refreshTokenSeconds === undefined) return undefined;

  return {
    accessTokenSeconds: toSeconds(accessTokenSeconds),
    refreshTokenSeconds: toSeconds(refreshTokenSeconds),
  };
}
