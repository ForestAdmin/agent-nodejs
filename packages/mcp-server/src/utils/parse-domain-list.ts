export default function parseDomainList(envValue?: string): string[] | undefined {
  if (!envValue) return undefined;

  const domains = envValue
    .split(',')
    .map(domain => domain.trim())
    .filter(Boolean);

  // A variable containing no domains means "not configured", never "block everyone".
  return domains.length > 0 ? domains : undefined;
}
