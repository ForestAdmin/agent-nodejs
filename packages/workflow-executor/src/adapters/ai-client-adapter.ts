import type { AiModelPort } from '../ports/ai-model-port';
import type { AiConfiguration, BaseChatModel, RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

import { AiClient } from '@forestadmin/ai-proxy';

import { AiModelPortError, WorkflowExecutorError } from '../errors';

export default class AiClientAdapter implements AiModelPort {
  private readonly aiClient: AiClient;

  constructor(aiConfigurations: AiConfiguration[]) {
    const withRetries = aiConfigurations.map(c => ({ maxRetries: 2, ...c }));
    this.aiClient = new AiClient({ aiConfigurations: withRetries as AiConfiguration[] });
  }

  getModel(aiConfigName?: string): BaseChatModel {
    try {
      return this.aiClient.getModel(aiConfigName);
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;
      throw new AiModelPortError('getModel', cause);
    }
  }

  loadRemoteTools(configs: Record<string, ToolConfig>): Promise<RemoteTool[]> {
    return this.callPort('loadRemoteTools', () => this.aiClient.loadRemoteTools(configs));
  }

  closeConnections(): Promise<void> {
    return this.callPort('closeConnections', () => this.aiClient.closeConnections());
  }

  private async callPort<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;
      throw new AiModelPortError(operation, cause);
    }
  }
}
