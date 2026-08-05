export default function normalizeDomainList(domains?: string[]): string[] | undefined {
  if (domains === undefined) return undefined;

  const entries = domains.map(domain => domain.trim()).filter(Boolean);

  if (entries.length === 0) {
    throw new Error(
      'Invalid allowedOAuthClients: no domains to allow. List at least one domain ' +
        '(e.g. dust.tt), or omit the option to accept any registered client.',
    );
  }

  return entries.map(entry => {
    if (/[/:\s]/.test(entry)) {
      throw new Error(
        `Invalid allowedOAuthClients entry "${entry}": list bare domains (e.g. dust.tt) ` +
          'without scheme, port, path, or spaces.',
      );
    }

    try {
      // URL canonicalizes the host to lowercase punycode — the same form the provider
      // extracts from redirect URIs at enforcement time, so unicode entries match.
      return new URL(`https://${entry}`).hostname;
    } catch {
      throw new Error(`Invalid allowedOAuthClients entry "${entry}": not a valid domain.`);
    }
  });
}
