import type { McpConfiguration } from './mcp-client';

import McpConfigChecker from './types/mcp-config-checker';

export * from './provider-dispatcher';
export * from './remote-tools';
export * from './router';
export * from './mcp-client';

export * from './types/errors';

// Client is exported from a separate entry point: @forestadmin/ai-proxy/client
// This avoids pulling langchain dependencies in frontend builds

export function validMcpConfigurationOrThrow(mcpConfig: McpConfiguration) {
  return McpConfigChecker.check(mcpConfig);
}
