import type { BaseChatModel, RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

export interface AiModelPort {
  getModel(aiConfigName?: string): BaseChatModel;
  loadRemoteTools(configs: Record<string, ToolConfig>): Promise<RemoteTool[]>;
  closeConnections(): Promise<void>;
}
