import net from 'net';

import { InvalidTokenEndpointError } from '../errors';

// The token endpoint comes from the deposit body, and the executor POSTs the refresh grant (with
// client credentials) to it — so an unconstrained value is an SSRF vector. The guard rejects hosts
// that are never a legitimate endpoint but are prime SSRF targets (loopback, link-local /
// cloud-metadata) and requires TLS, while deliberately allowing private (RFC1918) hosts: a private
// OAuth provider reached over the internal network is a supported deployment, so blocking it would
// break a real use case. http and loopback are relaxed off-production for local development.
// Only IP literals are inspected — resolving a hostname here would be racy (it can resolve to a
// different address at fetch time), not safer.

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function unbracket(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
}

function classifyIpv4(host: string): { loopback: boolean; linkLocal: boolean } {
  const [a, b] = host.split('.').map(Number);

  return { loopback: a === 127, linkLocal: a === 169 && b === 254 }; // 127.0.0.0/8, 169.254.0.0/16
}

// Returns the embedded IPv4 of an IPv4-mapped IPv6 address (otherwise null). The WHATWG URL parser
// normalizes `::ffff:127.0.0.1` to the hex form `::ffff:7f00:1`, which would otherwise dodge the
// IPv4 loopback/link-local checks and still reach the executor's loopback / metadata interface.
function embeddedIpv4(host: string): string | null {
  const tail = host.toLowerCase().match(/^::ffff:(.+)$/)?.[1];
  if (!tail) return null;

  if (net.isIPv4(tail)) return tail;

  const hex = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;

  const hi = parseInt(hex[1], 16); // high 16 bits → first two octets
  const lo = parseInt(hex[2], 16); // low 16 bits → last two octets

  return `${Math.floor(hi / 256)}.${hi % 256}.${Math.floor(lo / 256)}.${lo % 256}`;
}

function classify(host: string): { loopback: boolean; linkLocal: boolean } {
  const kind = net.isIP(host);

  if (kind === 4) return classifyIpv4(host);

  if (kind === 6) {
    const mapped = embeddedIpv4(host);
    if (mapped) return classifyIpv4(mapped);

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
