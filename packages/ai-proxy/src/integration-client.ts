import type McpServerRemoteTool from './types/mcp-server-remote-tool';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { MultiServerMCPClient } from '@langchain/mcp-adapters';

import getSlackTools, { type SlackConfig } from './integrations/slack/tools';
import getZendeskTools, { type ZendeskConfig } from './integrations/zendesk/tools';

export type McpConfiguration = {
  configs: MultiServerMCPClient['config']['mcpServers'];
} & Omit<MultiServerMCPClient['config'], 'mcpServers'>;

export interface ForestIntegrationConfig {
  integrationName: 'slack' | 'zendesk';
  config: SlackConfig | ZendeskConfig;
}

export default class IntegrationClient {
  private readonly logger?: Logger;

  readonly tools: McpServerRemoteTool[] = [];
  readonly configs: ForestIntegrationConfig[];

  constructor(configs: ForestIntegrationConfig[], logger?: Logger) {
    this.logger = logger;
    this.configs = configs;
  }

  loadTools(): McpServerRemoteTool[] {
    this.configs.forEach(({ integrationName, config }) => {
      switch (integrationName) {
        case 'slack':
          this.tools.push(...getSlackTools(config as SlackConfig));
          break;
        case 'zendesk':
          this.tools.push(...getZendeskTools(config as ZendeskConfig));
          break;
        default:
          this.logger?.('Warn', `Unsupported integration: ${integrationName}`);
      }
    });

    return this.tools;
  }
}
