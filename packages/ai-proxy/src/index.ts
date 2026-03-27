import type { ToolSourceConfig } from './tool-provider-factory';
import type { Logger } from '@forestadmin/datasource-toolkit';

import McpConfigChecker from './mcp-config-checker';

export { createAiProvider } from './create-ai-provider';
export { default as ProviderDispatcher } from './provider-dispatcher';

export { ForestIntegrationConfig, CustomConfig, ForestIntegrationName } from './integration-client';

export * from './provider-dispatcher';
export * from './remote-tools';
export { default as RemoteTool } from './remote-tool';
export * from './router';
export * from './mcp-client';
export * from './oauth-token-injector';
export * from './errors';
export * from './tool-provider';
export * from './tool-provider-factory';

export function validToolConfigurationOrThrow(
  configs: Record<string, ToolSourceConfig>,
  logger?: Logger,
) {
  return McpConfigChecker.check(configs, logger);
}

/** @deprecated Use validToolConfigurationOrThrow instead */
export const validMcpConfigurationOrThrow = validToolConfigurationOrThrow;
