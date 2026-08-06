export default function parseDomainList(envValue?: string): string[] | undefined {
  if (!envValue) return undefined;

  // A set value that yields no domains must fail closed downstream: treating it as
  // "not configured" would silently disable the allowlist on a quoting mistake.
  return envValue
    .split(',')
    .map(domain => domain.trim())
    .filter(Boolean);
}
