import type { McpConfiguration } from './mcp-client';

import McpConfigChecker from './mcp-config-checker';

export * from './provider-dispatcher';
export * from './remote-tools';
export * from './router';
export * from './mcp-client';
export * from './logger';

export * from './errors';

export function validMcpConfigurationOrThrow(mcpConfig: McpConfiguration) {
  return McpConfigChecker.check(mcpConfig);
}
