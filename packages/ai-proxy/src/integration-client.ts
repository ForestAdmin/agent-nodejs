import type RemoteTool from './remote-tool';
import type { ToolProvider } from './tool-provider';
import type { Logger } from '@forestadmin/datasource-toolkit';

import getZendeskTools, { type ZendeskConfig } from './integrations/zendesk/tools';
import { validateZendeskConfig } from './integrations/zendesk/utils';

export type CustomConfig = ZendeskConfig;
export type ForestIntegrationName = 'Zendesk';

export interface ForestIntegrationConfig {
  integrationName: ForestIntegrationName;
  config: CustomConfig;
  isForestConnector: true;
}

export default class IntegrationClient implements ToolProvider {
  private readonly logger?: Logger;
  private readonly configs: ForestIntegrationConfig[];

  constructor(configs: ForestIntegrationConfig[], logger?: Logger) {
    this.logger = logger;
    this.configs = configs;
  }

  async loadTools(): Promise<RemoteTool[]> {
    const tools: RemoteTool[] = [];

    this.configs.forEach(({ integrationName, config }) => {
      switch (integrationName) {
        case 'Zendesk':
          tools.push(...getZendeskTools(config as ZendeskConfig));
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
          default:
            throw new Error(`Unsupported integration: ${integrationName}`);
        }
      }),
    );

    return true;
  }

  async dispose(): Promise<void> {
    // No-op: integrations don't hold persistent connections
  }
}
