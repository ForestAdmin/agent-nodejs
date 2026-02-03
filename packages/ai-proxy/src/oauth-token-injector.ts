import type { McpConfiguration, McpServerConfig } from './mcp-client';

import { AIBadRequestError } from './errors';

export const MCP_OAUTH_TOKENS_HEADER = 'x-mcp-oauth-tokens';

/**
 * Extracts and parses OAuth tokens from request headers.
 * Returns undefined if the header is not present.
 * Throws AIBadRequestError if the header contains invalid JSON.
 */
export function extractMcpOauthTokensFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> | undefined {
  const headerValue = headers[MCP_OAUTH_TOKENS_HEADER];

  if (!headerValue) return undefined;

  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  try {
    return JSON.parse(value);
  } catch {
    throw new AIBadRequestError(`Invalid JSON in ${MCP_OAUTH_TOKENS_HEADER} header`);
  }
}

/**
 * Injects the OAuth token as Authorization header into HTTP-based transport configurations.
 * For stdio transports, returns the config unchanged.
 */
export function injectOauthToken({
  serverConfig,
  token,
}: {
  serverConfig: McpServerConfig;
  token?: string;
}): McpServerConfig {
  if (!token) return serverConfig;

  if (!token.startsWith('Bearer ')) {
    throw new AIBadRequestError('OAuth token must start with "Bearer "');
  }

  // Only inject token for HTTP-based transports (sse, http)
  if (serverConfig.type === 'http' || serverConfig.type === 'sse') {
    return {
      ...serverConfig,
      headers: {
        ...(serverConfig.headers || {}),
        Authorization: token,
      },
    };
  }

  return serverConfig;
}

/**
 * Injects OAuth tokens into all server configurations.
 * Returns a new McpConfiguration with tokens injected, or undefined if no configs provided.
 */
export function injectOauthTokens({
  mcpConfigs,
  tokensByMcpServerName,
}: {
  mcpConfigs: McpConfiguration | undefined;
  tokensByMcpServerName: Record<string, string> | undefined;
}): McpConfiguration | undefined {
  if (!mcpConfigs) return undefined;
  if (!tokensByMcpServerName) return mcpConfigs;

  const configsWithTokens = Object.fromEntries(
    Object.entries(mcpConfigs.configs).map(([name, serverConfig]) => [
      name,
      injectOauthToken({ serverConfig, token: tokensByMcpServerName[name] }),
    ]),
  );

  return { ...mcpConfigs, configs: configsWithTokens };
}
