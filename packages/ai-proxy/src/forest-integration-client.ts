import type RemoteTool from './remote-tool';
import type { ToolProvider } from './tool-provider';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { AIBadRequestError } from './errors';
import getKolarTools, { type KolarConfig } from './integrations/kolar/tools';
import { validateKolarConfig } from './integrations/kolar/utils';
import getSnowflakeTools, { type SnowflakeConfig } from './integrations/snowflake/tools';
import { validateSnowflakeConfig } from './integrations/snowflake/utils';
import getZendeskTools, { type ZendeskConfig } from './integrations/zendesk/tools';
import { validateZendeskConfig } from './integrations/zendesk/utils';

export type CustomConfig = ZendeskConfig | KolarConfig | SnowflakeConfig;
export type ForestIntegrationName = 'Zendesk' | 'Kolar' | 'Snowflake';

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

  async loadTools(): Promise<RemoteTool[]> {
    const tools: RemoteTool[] = [];

    this.configs.forEach(({ id: mcpServerId, integrationName, config }) => {
      switch (integrationName) {
        case 'Zendesk':
          tools.push(...getZendeskTools(config as ZendeskConfig, mcpServerId));
          break;
        case 'Kolar':
          tools.push(...getKolarTools(config as KolarConfig, mcpServerId));
          break;
        case 'Snowflake':
          tools.push(...getSnowflakeTools(config as SnowflakeConfig, mcpServerId));
          break;
        default:
          this.logger?.('Warn', `Unsupported integration: ${integrationName}`);
      }
    });

    return tools;
  }

  async checkConnection(): Promise<true> {
    await Promise.all(
      this.configs.map(({ integrationName, config }) => {
        switch (integrationName) {
          case 'Zendesk':
            return validateZendeskConfig(config as ZendeskConfig);
          case 'Kolar':
            return validateKolarConfig(config as KolarConfig);
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
