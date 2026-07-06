export type McpRouteMatcher = (url: string) => boolean;

export function normalizeMountPath(input?: string): string {
  if (!input) return '';

  const trimmed = input.trim();
  if (trimmed === '' || trimmed === '/') return '';

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, '/').replace(/\/+$/, '');

  // The prefix is interpolated raw into Express/Koa route patterns AND resolved through
  // new URL() to advertise the OAuth metadata. Reject anything that makes those diverge:
  // path-to-regexp metacharacters, or segments new URL() rewrites (backslash, '.', '..', %-escapes).
  const urlPath = new URL(collapsed.slice(1), 'http://forestadmin.invalid/').pathname.replace(
    /\/+$/,
    '',
  );

  if (/[?#\s\\:*()+%[\]]/.test(collapsed) || urlPath !== collapsed) {
    throw new Error(
      `Invalid MCP mount path "${input}": use a plain path prefix like "/mcp" ` +
        `(no "..", backslashes, %-escapes, or route metacharacters).`,
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

  // Match on a segment boundary so a claimed path like '/ai/mcp' does not shadow an
  // unrelated host route like '/ai/mcp-dashboard'.
  return (url: string) =>
    paths.some(p => url === p || url.startsWith(p.endsWith('/') ? p : `${p}/`));
}

export const MCP_PATHS = buildMcpPaths('');

export const isMcpRoute = makeIsMcpRoute('');
