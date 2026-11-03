export interface AuthorizationCodeClaims {
  claim(code: string): boolean;
  release(code: string): void;
}

export interface AuthorizationCodeClaimsOptions {
  now: () => number;
  ttlSeconds?: number;
  maxPending?: number;
}

const DEFAULT_TTL_SECONDS = 5 * 60;
const DEFAULT_MAX_PENDING = 10_000;

export default function createAuthorizationCodeClaims({
  now,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  maxPending = DEFAULT_MAX_PENDING,
}: AuthorizationCodeClaimsOptions): AuthorizationCodeClaims {
  const usedCodes = new Map<string, number>();

  function purgeExpired(): void {
    const current = now();

    for (const [code, expiresAt] of usedCodes) {
      if (current >= expiresAt) usedCodes.delete(code);
    }
  }

  return {
    claim(code) {
      purgeExpired();
      if (usedCodes.has(code)) return false;

      if (usedCodes.size >= maxPending) return false;

      usedCodes.set(code, now() + ttlSeconds * 1000);

      return true;
    },

    release(code) {
      usedCodes.delete(code);
    },
  };
}
