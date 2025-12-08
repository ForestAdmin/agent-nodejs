import type { McpConfiguration } from '@forestadmin/ai-proxy';

export interface McpServerConfigService {
  getConfiguration(): Promise<McpConfiguration>;
}
