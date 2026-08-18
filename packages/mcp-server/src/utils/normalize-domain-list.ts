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
    // '@' would make URL parse everything before it as userinfo and return the wrong
    // hostname; '\' acts as a path separator in WHATWG URLs, silently truncating.
    if (/[/:@?#\\\s]/.test(entry)) {
      throw new Error(
        `Invalid allowedOAuthClients entry "${entry}": list bare domains (e.g. dust.tt) ` +
          'without scheme, port, path, or spaces.',
      );
    }

    try {
      // URL canonicalizes the host to lowercase punycode — the same form the provider
      // extracts from redirect URIs at enforcement time, so unicode entries match.
      // The root dot of an FQDN-style entry is dropped: redirect URI hostnames never
      // carry one, so keeping it would silently reject every client for that domain.
      return new URL(`https://${entry}`).hostname.replace(/\.$/, '');
    } catch {
      throw new Error(`Invalid allowedOAuthClients entry "${entry}": not a valid domain.`);
    }
  });
}
