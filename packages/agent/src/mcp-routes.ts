/**
 * MCP route patterns claimed at the root of the host application. The MCP server filters on them
 * itself too; this is what tells the agent's root middleware which requests to offer it.
 */
const MCP_ROUTE_PATTERNS = ['/.well-known/', '/oauth/', '/mcp'];

export default function isMcpRoute(url: string): boolean {
  return MCP_ROUTE_PATTERNS.some(pattern => url.startsWith(pattern));
}
