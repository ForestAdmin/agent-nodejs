/** MCP-specific paths that should be handled by the MCP server */
export const MCP_PATHS = ['/.well-known/', '/oauth/', '/mcp'];

/** Check if a URL is an MCP route */
export function isMcpRoute(url: string): boolean {
  return MCP_PATHS.some(p => url === p || url.startsWith(p));
}
