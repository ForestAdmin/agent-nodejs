export type McpRouteMatcher = (url: string) => boolean;

export function normalizeMountPath(input?: string): string {
  if (!input) return '';

  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '/') return '';

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, '/').replace(/\/+$/, '');

  // Allow only unreserved path characters per segment. The prefix is interpolated raw into
  // Express/Koa route patterns (path-to-regexp) and resolved through new URL() for the OAuth
  // metadata; an allowlist keeps those two interpretations identical and future-proof.
  if (!/^(\/[A-Za-z0-9_-]+)+$/.test(collapsed)) {
    throw new Error(
      `Invalid MCP mount path "${input}": use a plain path prefix like "/mcp" ` +
        `(letters, digits, "-" and "_" only).`,
    );
  }

  return collapsed;
}

/**
 * Well-known paths stay anchored at the origin root (per RFC 8414/9728) but carry the prefix
 * as a suffix, so a host's own root OAuth metadata is not claimed.
 */
export function buildMcpPaths(prefix = ''): string[] {
  const normalized = normalizeMountPath(prefix);

  const wellKnown = normalized
    ? [
        `/.well-known/oauth-authorization-server${normalized}`,
        `/.well-known/oauth-protected-resource${normalized}`,
      ]
    : ['/.well-known/'];

  return [...wellKnown, `${normalized}/oauth/`, `${normalized}/mcp`];
}

export function makeIsMcpRoute(prefix = ''): McpRouteMatcher {
  const paths = buildMcpPaths(prefix);

  // Match on the pathname (req.url carries the query string) and on a segment boundary, so
  // '/mcp?x=1' still matches and '/ai/mcp' does not shadow '/ai/mcp-dashboard'.
  return (url: string) => {
    const [pathname] = url.split(/[?#]/, 1);

    return paths.some(p => pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`));
  };
}

export const MCP_PATHS = buildMcpPaths('');

export const isMcpRoute = makeIsMcpRoute('');
