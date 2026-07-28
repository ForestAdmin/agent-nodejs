import type { Logger } from '../server';

// The MCP SDK rate-limits /oauth/token to 50 requests per 15 minutes (one per 18s) per IP and
// server.ts does not override it. 60s leaves margin for clients sharing an egress IP.
export const MIN_TOKEN_TTL_SECONDS = 60;

export type TokenTtlOptions = {
  /** Caps the access token lifetime. Forest grants 3600s (1 hour). */
  accessTokenSeconds?: number;
  /** Caps the time between two interactive logins. Forest grants 691200s (8 days). */
  refreshTokenSeconds?: number;
};

function normalizeSeconds(
  field: keyof TokenTtlOptions,
  value: number | undefined,
  logger: Logger,
): number | undefined {
  if (value === undefined) return undefined;

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid tokenTtl.${field} "${value}": it must be a positive integer number of seconds.`,
    );
  }

  if (value < MIN_TOKEN_TTL_SECONDS) {
    logger(
      'Warn',
      `[ForestOAuthProvider] raising tokenTtl.${field} from ${value} to the ` +
        `${MIN_TOKEN_TTL_SECONDS}s minimum`,
    );

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

export function capTtl(upstreamTtlSeconds: number, capSeconds?: number): number {
  return capSeconds === undefined ? upstreamTtlSeconds : Math.min(upstreamTtlSeconds, capSeconds);
}

// Anchored on the interactive login, not on the current refresh: Forest grants a full refresh
// lifetime on every refresh, so a per-refresh bound would slide forever and never force a re-login.
export function sessionRemainingSeconds({
  refreshTokenSeconds,
  sessionStartedAt,
  nowInSeconds,
}: {
  refreshTokenSeconds?: number;
  sessionStartedAt: number;
  nowInSeconds: number;
}): number {
  if (refreshTokenSeconds === undefined) return Number.POSITIVE_INFINITY;

  return sessionStartedAt + refreshTokenSeconds - nowInSeconds;
}
