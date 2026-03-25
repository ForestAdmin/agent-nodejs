import type McpServerRemoteTool from './mcp-server-remote-tool';
import type { Logger } from '@forestadmin/datasource-toolkit';

import getZendeskTools, { type ZendeskConfig } from './integrations/zendesk/tools';

export type CustomConfig = ZendeskConfig;
export type ForestIntegrationName = 'Zendesk';

export interface ForestIntegrationConfig {
  integrationName: ForestIntegrationName;
  config: CustomConfig;
  isForestConnector: true;
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
    this.tools.length = 0;
    this.configs.forEach(({ integrationName, config }) => {
      switch (integrationName) {
        case 'Zendesk':
          this.tools.push(...getZendeskTools(config as ZendeskConfig));
          break;
        default:
          this.logger?.('Warn', `Unsupported integration: ${integrationName}`);
      }
    });

    return this.tools;
  }
}
