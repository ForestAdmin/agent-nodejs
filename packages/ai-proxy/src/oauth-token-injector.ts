import type { McpServerConfig } from './mcp-client';
import type { ToolSourceConfig } from './tool-provider-factory';

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
 * Injects OAuth tokens into tool source configurations.
 * Only MCP server configs receive token injection; Forest integration configs are passed through.
 */
export function injectOauthTokens({
  configs,
  tokensByMcpServerName,
}: {
  configs: Record<string, ToolSourceConfig> | undefined;
  tokensByMcpServerName: Record<string, string> | undefined;
}): Record<string, ToolSourceConfig> | undefined {
  if (!configs) return undefined;
  if (!tokensByMcpServerName) return configs;

  return Object.fromEntries(
    Object.entries(configs).map(([name, config]) => {
      if ('isForestConnector' in config) return [name, config];

      return [
        name,
        injectOauthToken({
          serverConfig: config as McpServerConfig,
          token: tokensByMcpServerName[name],
        }),
      ];
    }),
  );
}
