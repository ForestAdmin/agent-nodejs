import type { AiModelPort, GetModelOptions } from '../ports/ai-model-port';
import type { AiConfiguration, BaseChatModel, RemoteTool, ToolConfig } from '@forestadmin/ai-proxy';

import { AiClient } from '@forestadmin/ai-proxy';

import { AiModelPortError, WorkflowExecutorError } from '../errors';

export interface ServerAiAdapterOptions {
  forestServerUrl: string;
  envSecret: string;
}

export default class ServerAiAdapter implements AiModelPort {
  private readonly options: ServerAiAdapterOptions;
  private readonly aiClient: AiClient;

  constructor(options: ServerAiAdapterOptions) {
    this.options = options;
    this.aiClient = new AiClient({
      aiConfigurations: [ServerAiAdapter.buildProxyConfiguration(options)],
    });
  }

  getModel({ userId }: GetModelOptions = {}): BaseChatModel {
    try {
      const client = new AiClient({
        aiConfigurations: [ServerAiAdapter.buildProxyConfiguration(this.options, userId)],
      });

      return client.getModel();
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

  // Every call is routed to the Forest server's AI proxy, which picks the real provider/model.
  // The model name is therefore a placeholder, and fetch is rewritten to hit the proxy with the
  // env secret instead of an OpenAI Authorization header.
  private static buildProxyConfiguration(
    { forestServerUrl, envSecret }: ServerAiAdapterOptions,
    userId?: number,
  ): AiConfiguration {
    const aiProxyUrl = `${forestServerUrl}/liana/v1/ai-proxy`;

    return {
      name: 'forest-server',
      provider: 'openai',
      model: 'gpt-4.1',
      maxRetries: 2,
      configuration: {
        apiKey: 'unused',
        fetch: (_url: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          headers.delete('authorization');
          headers.set('forest-secret-key', envSecret);
          // Attributes AI usage to the triggering user (proxy route has no user context).
          if (userId !== undefined) headers.set('user-id', String(userId));

          return fetch(aiProxyUrl, { ...init, headers });
        },
      },
    };
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
