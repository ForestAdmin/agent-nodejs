import type { McpServerLoadFailure } from './mcp-client';
import type RemoteTool from './remote-tool';
import type { ToolProvider } from './tool-provider';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { AIBadRequestError } from './errors';
import getSnowflakeTools, { type SnowflakeConfig } from './integrations/snowflake/tools';
import { validateSnowflakeConfig } from './integrations/snowflake/utils';
import getZendeskTools, { type ZendeskConfig } from './integrations/zendesk/tools';
import { validateZendeskConfig } from './integrations/zendesk/utils';

export type CustomConfig = ZendeskConfig | SnowflakeConfig;
export const FOREST_INTEGRATION_NAMES = ['Zendesk', 'Snowflake'] as const;
export type ForestIntegrationName = (typeof FOREST_INTEGRATION_NAMES)[number];

export interface ForestIntegrationConfig {
  id?: string;
  integrationName: ForestIntegrationName;
  config: CustomConfig;
  isForestConnector: true;
}

export function isForestIntegrationConfig(
  config: ForestIntegrationConfig | Record<string, unknown>,
): config is ForestIntegrationConfig {
  return (
    'isForestConnector' in config && (config as ForestIntegrationConfig).isForestConnector === true
  );
}

export default class ForestIntegrationClient implements ToolProvider {
  private readonly logger?: Logger;
  private readonly configs: ForestIntegrationConfig[];

  constructor(configs: ForestIntegrationConfig[], logger?: Logger) {
    this.logger = logger;
    this.configs = configs;
  }

  async loadToolsWithFailures(): Promise<{
    tools: RemoteTool[];
    failures: McpServerLoadFailure[];
  }> {
    const tools: RemoteTool[] = [];
    const failures: McpServerLoadFailure[] = [];

    this.configs.forEach(({ id: mcpServerId, integrationName, config }) => {
      switch (integrationName) {
        case 'Zendesk':
          tools.push(...getZendeskTools(config as ZendeskConfig, mcpServerId));
          break;
        case 'Snowflake':
          tools.push(...getSnowflakeTools(config as SnowflakeConfig, mcpServerId));
          break;
        default:
          this.logger?.('Warn', `Unsupported integration: ${integrationName}`);
          // Reporting it is what stops a caller reading an integration this build doesn't know as
          // a healthy connector that publishes nothing.
          failures.push({
            server: integrationName,
            mcpServerId,
            kind: 'unknown',
            error: new Error(`Unsupported integration: ${integrationName}`),
          });
      }
    });

    return { tools, failures };
  }

  async loadTools(): Promise<RemoteTool[]> {
    return (await this.loadToolsWithFailures()).tools;
  }

  async checkConnection(): Promise<true> {
    await Promise.all(
      this.configs.map(({ integrationName, config }) => {
        switch (integrationName) {
          case 'Zendesk':
            return validateZendeskConfig(config as ZendeskConfig);
          case 'Snowflake':
            return validateSnowflakeConfig(config as SnowflakeConfig);
          default:
            throw new AIBadRequestError(`Unsupported integration: ${integrationName}`);
        }
      }),
    );

    return true;
  }

  async dispose(): Promise<void> {
    // No-op: integrations don't hold persistent connections
  }
}
