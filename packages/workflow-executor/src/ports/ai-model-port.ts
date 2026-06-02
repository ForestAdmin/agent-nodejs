import type { RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface AiModelPort {
  getModel(aiConfigName?: string): BaseChatModel;
  loadRemoteTools(configs: Record<string, ToolConfig>): Promise<RemoteTool[]>;
  closeConnections(): Promise<void>;
}
