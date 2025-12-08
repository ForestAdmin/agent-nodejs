import type { McpConfiguration } from './mcp-client';

import McpClient from './mcp-client';

export default class McpConfigChecker {
  static check(mcpConfig: McpConfiguration) {
    return new McpClient(mcpConfig).testConnections();
  }
}
