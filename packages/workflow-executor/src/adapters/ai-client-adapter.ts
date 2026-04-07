import type { AiModelPort } from '../ports/ai-model-port';
import type { AiConfiguration, McpConfiguration, RemoteTool } from '@forestadmin/ai-proxy';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { AiClient } from '@forestadmin/ai-proxy';

export default class AiClientAdapter implements AiModelPort {
  private readonly aiClient: AiClient;

  constructor(aiConfigurations: AiConfiguration[]) {
    const withRetries = aiConfigurations.map(c => ({ maxRetries: 2, ...c }));
    this.aiClient = new AiClient({ aiConfigurations: withRetries as AiConfiguration[] });
  }

  getModel(aiConfigName?: string): BaseChatModel {
    return this.aiClient.getModel(aiConfigName);
  }

  loadRemoteTools(config: McpConfiguration): Promise<RemoteTool[]> {
    return this.aiClient.loadRemoteTools(config);
  }

  closeConnections(): Promise<void> {
    return this.aiClient.closeConnections();
  }
}
