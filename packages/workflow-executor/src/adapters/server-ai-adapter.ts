import type { AiModelPort } from '../ports/ai-model-port';
import type { McpConfiguration, RemoteTool } from '@forestadmin/ai-proxy';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { AiClient } from '@forestadmin/ai-proxy';
import { ChatOpenAI } from '@langchain/openai';

export interface ServerAiAdapterOptions {
  forestServerUrl: string;
  envSecret: string;
}

export default class ServerAiAdapter implements AiModelPort {
  private readonly forestServerUrl: string;
  private readonly envSecret: string;
  private readonly aiClient: AiClient;

  constructor(options: ServerAiAdapterOptions) {
    this.forestServerUrl = options.forestServerUrl;
    this.envSecret = options.envSecret;
    this.aiClient = new AiClient();
  }

  getModel(): BaseChatModel {
    const aiProxyUrl = `${this.forestServerUrl}/liana/v1/ai-proxy`;
    const { envSecret } = this;

    return new ChatOpenAI({
      // Model has no effect — the server uses its own configured model.
      // Set here only because ChatOpenAI requires it.
      model: 'gpt-4.1',
      maxRetries: 2,
      configuration: {
        apiKey: 'unused',
        fetch: (_url: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers);
          headers.delete('authorization');
          headers.set('forest-secret-key', envSecret);

          return fetch(aiProxyUrl, { ...init, headers });
        },
      },
    });
  }

  loadRemoteTools(config: McpConfiguration): Promise<RemoteTool[]> {
    return this.aiClient.loadRemoteTools(config);
  }

  closeConnections(): Promise<void> {
    return this.aiClient.closeConnections();
  }
}
