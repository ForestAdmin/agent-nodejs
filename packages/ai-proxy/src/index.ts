import type { ToolConfig } from './tool-provider-factory';
import type { Logger } from '@forestadmin/datasource-toolkit';

import ToolSourceChecker from './tool-source-checker';

export { createAiProvider } from './create-ai-provider';
export { default as ProviderDispatcher } from './provider-dispatcher';

export { ForestIntegrationConfig, CustomConfig, ForestIntegrationName } from './forest-integration-client';

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
  configs: Record<string, ToolConfig>,
  logger?: Logger,
) {
  return ToolSourceChecker.check(configs, logger);
}
