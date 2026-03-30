import type { ToolConfig } from '@forestadmin/ai-proxy';

export interface McpServerConfigService {
  getConfiguration(): Promise<Record<string, ToolConfig>>;
}
