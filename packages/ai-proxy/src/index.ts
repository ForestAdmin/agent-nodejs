import type { McpConfiguration } from './mcp-client';

import McpConfigChecker from './mcp-config-checker';

export { createAiProvider } from './create-ai-provider';
export * from './provider-dispatcher';
export * from './remote-tools';
export * from './router';
export * from './mcp-client';
export * from './oauth-token-injector';
export * from './errors';

export function validMcpConfigurationOrThrow(mcpConfig: McpConfiguration) {
  return McpConfigChecker.check(mcpConfig);
}
