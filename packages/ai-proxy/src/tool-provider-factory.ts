import type { ToolProvider } from './tool-provider';
import type { Logger } from '@forestadmin/datasource-toolkit';

import IntegrationClient, { type ForestIntegrationConfig } from './integration-client';
import McpClient, { type McpConfiguration, type McpServerConfig } from './mcp-client';

export type ToolSourceConfig = McpServerConfig | ForestIntegrationConfig;

function isForestIntegrationConfig(config: ToolSourceConfig): config is ForestIntegrationConfig {
  return 'isForestConnector' in config && config.isForestConnector === true;
}

export function createToolProviders(
  configs: Record<string, ToolSourceConfig>,
  logger?: Logger,
): ToolProvider[] {
  const mcpConfigs: McpConfiguration['configs'] = {};
  const integrationConfigs: ForestIntegrationConfig[] = [];

  for (const [name, config] of Object.entries(configs)) {
    if (isForestIntegrationConfig(config)) {
      integrationConfigs.push(config);
    } else {
      mcpConfigs[name] = config;
    }
  }

  const providers: ToolProvider[] = [];

  if (Object.keys(mcpConfigs).length > 0) {
    providers.push(new McpClient({ configs: mcpConfigs }, logger));
  }

  if (integrationConfigs.length > 0) {
    providers.push(new IntegrationClient(integrationConfigs, logger));
  }

  return providers;
}
