import type { BaseChatModel, RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

export interface GetModelOptions {
  aiConfigName?: string;
  userId?: number;
}

export interface AiModelPort {
  getModel(options?: GetModelOptions): BaseChatModel;
  loadRemoteTools(configs: Record<string, ToolConfig>): Promise<RemoteTool[]>;
  closeConnections(): Promise<void>;
}
