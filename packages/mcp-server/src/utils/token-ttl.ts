import type { Logger } from '../server';

// The MCP SDK rate-limits /oauth/token to 50 requests per 15 minutes and server.ts does not
// override it, so a lifetime under ~18s makes a client exhaust its own token quota and get 429s.
// 60s also stays clear of clock drift between agent instances: verifyAccessToken and the SDK's
// bearer middleware both compare timestamps with a zero clock tolerance.
export const MIN_TOKEN_TTL_SECONDS = 60;

export type TokenTtlOptions = {
  accessTokenSeconds?: number;
  refreshTokenSeconds?: number;
};

function normalizeSeconds(
  field: string,
  value: number | undefined,
  logger: Logger,
): number | undefined {
  if (value === undefined) return undefined;

  // Fail closed rather than falling back to a default: a silently ignored cap would leave the
  // customer believing their tokens are short-lived when they are not.
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid tokenTtl.${field} "${value}": it must be a positive integer number of seconds.`,
    );
  }

  if (value < MIN_TOKEN_TTL_SECONDS) {
    logger('Warn', `ignoring tokenTtl.${field}: minimum value is ${MIN_TOKEN_TTL_SECONDS} seconds`);

    return MIN_TOKEN_TTL_SECONDS;
  }

  return value;
}

export default function normalizeTokenTtl(
  tokenTtl: TokenTtlOptions | undefined,
  logger: Logger,
): TokenTtlOptions | undefined {
  const accessTokenSeconds = normalizeSeconds(
    'accessTokenSeconds',
    tokenTtl?.accessTokenSeconds,
    logger,
  );
  const refreshTokenSeconds = normalizeSeconds(
    'refreshTokenSeconds',
    tokenTtl?.refreshTokenSeconds,
    logger,
  );

  if (accessTokenSeconds === undefined && refreshTokenSeconds === undefined) return undefined;

  return { accessTokenSeconds, refreshTokenSeconds };
}

export function capAccessTokenTtl(upstreamTtlSeconds: number, capSeconds?: number): number {
  return capSeconds === undefined ? upstreamTtlSeconds : Math.min(upstreamTtlSeconds, capSeconds);
}

// Anchored on the interactive login rather than on the current refresh: the Forest server grants a
// full refresh lifetime on every refresh, so a per-refresh cap would slide forever and never force
// a re-login.
export function capRefreshTokenTtl({
  upstreamTtlSeconds,
  capSeconds,
  sessionStartedAt,
  nowInSeconds,
}: {
  upstreamTtlSeconds: number;
  capSeconds?: number;
  sessionStartedAt: number;
  nowInSeconds: number;
}): number {
  if (capSeconds === undefined) return upstreamTtlSeconds;

  return Math.min(upstreamTtlSeconds, sessionStartedAt + capSeconds - nowInSeconds);
}
