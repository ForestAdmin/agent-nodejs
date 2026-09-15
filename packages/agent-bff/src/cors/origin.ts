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

const WILDCARD_LABEL_PREFIX = '*.';
const MIN_WILDCARD_HOST_LABELS = 2;

interface AllowedEntry {
  origin: string;
  wildcard: boolean;
}

function parseAllowedEntry(raw: string): AllowedEntry | null {
  const origin = normalizeOrigin(raw);
  if (origin === null) return null;

  const { hostname } = new URL(origin);
  const stars = hostname.split('*').length - 1;

  if (stars === 0) return { origin, wildcard: false };
  if (stars > 1 || !hostname.startsWith(WILDCARD_LABEL_PREFIX)) return null;

  const parentLabels = hostname.slice(WILDCARD_LABEL_PREFIX.length).split('.');

  if (parentLabels.length < MIN_WILDCARD_HOST_LABELS || parentLabels.some(label => label === '')) {
    return null;
  }

  return { origin, wildcard: true };
}

function matchesWildcard(entry: URL, request: URL): boolean {
  if (entry.protocol !== request.protocol || entry.port !== request.port) return false;

  const suffixWithDot = entry.hostname.slice('*'.length);
  if (!request.hostname.endsWith(suffixWithDot)) return false;

  const head = request.hostname.slice(0, -suffixWithDot.length);

  return head !== '' && !head.includes('.');
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
    const parsed = parseAllowedEntry(entry);

    if (parsed === null) invalid.push(entry);
    else if (!origins.includes(parsed.origin)) origins.push(parsed.origin);
  }

  return { origins, invalid };
}

export function originAllowed(requestOrigin: string | undefined, allowList: string[]): boolean {
  const normalized = normalizeOrigin(requestOrigin);
  if (normalized === null) return false;

  const request = new URL(normalized);
  if (request.hostname.includes('*')) return false;

  return allowList.some(raw => {
    const entry = parseAllowedEntry(raw);

    if (entry === null) return false;
    if (!entry.wildcard) return entry.origin === normalized;

    return matchesWildcard(new URL(entry.origin), request);
  });
}

export function allowedEntriesIntersect(left: string, right: string): boolean {
  const a = parseAllowedEntry(left);
  const b = parseAllowedEntry(right);

  if (a === null || b === null) return false;
  if (a.wildcard && b.wildcard) return a.origin === b.origin;
  if (a.wildcard) return matchesWildcard(new URL(a.origin), new URL(b.origin));
  if (b.wildcard) return matchesWildcard(new URL(b.origin), new URL(a.origin));

  return a.origin === b.origin;
}
