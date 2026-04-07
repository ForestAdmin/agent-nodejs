import type { McpConfiguration, RemoteTool } from '@forestadmin/ai-proxy';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface AiModelPort {
  getModel(aiConfigName?: string): BaseChatModel;
  loadRemoteTools(config: McpConfiguration): Promise<RemoteTool[]>;
  closeConnections(): Promise<void>;
}
