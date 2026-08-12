/**
 * Collection, relation and action names are arbitrary customer strings: spaces, dots, slashes,
 * accents. A path segment carries them URL-encoded, but an `operationId` cannot — redocly rejects a
 * non-URL-safe one, and a codegen tool turns it into a method name. So identifiers are sanitized,
 * and the exact name is carried in prose instead.
 */
export function sanitizeIdentifier(raw: string): string {
  return raw.replace(/[^A-Za-z0-9_]/g, '_') || '_';
}

/**
 * Hands out unique sanitized identifiers. Sanitizing collapses distinct names (`Mark as paid` and
 * `Mark-as-paid` both become `Mark_as_paid`), so the second one gets a numeric suffix. Callers must
 * feed names in a stable order — the suffix depends on it, and two runs over one schema have to
 * produce the same document.
 */
export default function createNamer(): (raw: string) => string {
  const used = new Set<string>();

  return (raw: string): string => {
    const base = sanitizeIdentifier(raw);
    let candidate = base;
    let counter = 2;

    while (used.has(candidate)) {
      candidate = `${base}_${counter}`;
      counter += 1;
    }

    used.add(candidate);

    return candidate;
  };
}
