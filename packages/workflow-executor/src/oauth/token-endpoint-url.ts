import net from 'net';

import { InvalidTokenEndpointError } from '../errors';

// Constrains the OAuth token endpoint without breaking intended private-provider support:
//   - scheme must be http(s); in production it must be https (http stays allowed off-prod, since the
//     local OAuth sim runs on http);
//   - link-local (incl. cloud metadata, e.g. 169.254.169.254) is never a valid endpoint — blocked
//     on every environment;
//   - loopback / the executor host itself is blocked in production (allowed off-prod for the sim);
//   - RFC1918 private ranges stay allowed — a private OAuth provider refreshes from inside the
//     customer network by design (see PRD-367).
// IP-literal hosts cover the direct SSRF the deposit flow enables; hostnames are not DNS-resolved
// here, as a resolve-then-fetch check is racy (the resolution at fetch time can differ).

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function unbracket(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

function classify(host: string): { loopback: boolean; linkLocal: boolean } {
  const kind = net.isIP(host);

  if (kind === 4) {
    const [a, b] = host.split('.').map(Number);

    return { loopback: a === 127, linkLocal: a === 169 && b === 254 };
  }

  if (kind === 6) {
    const normalized = host.toLowerCase().split('%')[0]; // drop any zone id
    const firstHextet = normalized.split(':')[0];

    return {
      loopback: normalized === '::1' || normalized === '0:0:0:0:0:0:0:1',
      linkLocal: /^fe[89ab]/.test(firstHextet), // fe80::/10
    };
  }

  // Not an IP literal — only the obvious local alias is treated as loopback; other hostnames are
  // left to the scheme rule (not resolved).
  return { loopback: host.toLowerCase() === 'localhost', linkLocal: false };
}

export default function assertSafeTokenEndpoint(raw: string): void {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new InvalidTokenEndpointError('it is not a valid absolute URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new InvalidTokenEndpointError('it must use http or https');
  }

  const { loopback, linkLocal } = classify(unbracket(url.hostname));

  if (linkLocal) {
    throw new InvalidTokenEndpointError('it points at a link-local / metadata address');
  }

  if (isProduction()) {
    if (url.protocol !== 'https:') {
      throw new InvalidTokenEndpointError('it must use https');
    }

    if (loopback) {
      throw new InvalidTokenEndpointError('it points at the executor host (loopback)');
    }
  }
}
