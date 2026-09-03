const MAX_LOGGED_ORIGIN_LENGTH = 256;

/**
 * The origin as it is safe to log: caller-controlled, so a header near Node's ~16kb limit would
 * otherwise land verbatim in one Warn per rejected request, with no rate limit above it. The
 * truncation marker keeps a cut value from reading like the real one.
 */
export function loggableOrigin(raw: string): string {
  return raw.length > MAX_LOGGED_ORIGIN_LENGTH ? `${raw.slice(0, MAX_LOGGED_ORIGIN_LENGTH)}…` : raw;
}

export function hasOrigin(raw: string | undefined | null): raw is string {
  return raw !== undefined && raw !== null && raw.trim() !== '';
}

export function normalizeOrigin(raw: string | undefined | null): string | null {
  if (!hasOrigin(raw)) return null;

  const trimmed = raw.trim();
  if (trimmed === 'null') return null;

  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.origin === 'null') return null;

  return url.origin;
}

export function parseAllowedOrigins(raw: string | undefined): {
  origins: string[];
  invalid: string[];
} {
  if (raw === undefined || raw.trim() === '') return { origins: [], invalid: [] };

  const origins: string[] = [];
  const invalid: string[] = [];

  const entries = raw
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry !== '');

  for (const entry of entries) {
    const normalized = normalizeOrigin(entry);

    if (normalized === null) invalid.push(entry);
    else if (!origins.includes(normalized)) origins.push(normalized);
  }

  return { origins, invalid };
}

export function originAllowed(requestOrigin: string | undefined, allowList: string[]): boolean {
  const normalized = normalizeOrigin(requestOrigin);
  if (normalized === null) return false;

  return allowList.some(entry => normalizeOrigin(entry) === normalized);
}
