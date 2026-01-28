import type { McpConfiguration } from '../mcp-client';

import McpClient from '../mcp-client';

export default class McpConfigChecker {
  static check(mcpConfig: McpConfiguration, mcpOauthTokens?: Record<string, string>) {
    return new McpClient(mcpConfig, undefined, mcpOauthTokens).testConnections();
  }
}
