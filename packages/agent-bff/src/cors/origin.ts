export function normalizeOrigin(raw: string | undefined | null): string | null {
  if (raw === undefined || raw === null) return null;

  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'null') return null;

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
