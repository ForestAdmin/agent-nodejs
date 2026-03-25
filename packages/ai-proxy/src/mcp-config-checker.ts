import type { ForestIntegrationConfig } from './integration-client';
import type { McpConfiguration } from './mcp-client';

import { validateZendeskConfig } from './integrations/zendesk/utils';
import McpClient from './mcp-client';

export default class McpConfigChecker {
  static isForestIntegrationConfig(
    config: McpConfiguration | ForestIntegrationConfig,
  ): config is ForestIntegrationConfig {
    return 'integrationName' in config;
  }

  static check(mcpConfig: McpConfiguration | ForestIntegrationConfig) {
    if (McpConfigChecker.isForestIntegrationConfig(mcpConfig)) {
      switch (mcpConfig.integrationName) {
        case 'Zendesk':
          return validateZendeskConfig(mcpConfig.config);
        default:
          throw new Error(`Unsupported integration: ${mcpConfig.integrationName}`);
      }
    }

    return new McpClient(mcpConfig).testConnections();
  }
}
