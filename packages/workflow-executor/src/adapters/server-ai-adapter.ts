import type { AiModelPort } from '../ports/ai-model-port';
import type { PendingStepExecution } from '../types/execution';
import type { McpConfiguration, RemoteTool } from '@forestadmin/ai-proxy';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { AiClient } from '@forestadmin/ai-proxy';
import { ChatOpenAI } from '@langchain/openai';
import jsonwebtoken from 'jsonwebtoken';

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

  getModel(step: PendingStepExecution): BaseChatModel {
    const jwt = jsonwebtoken.sign(
      { envId: step.envId, userId: step.user.id, runId: step.runId, stepIndex: step.stepIndex },
      this.envSecret,
      { expiresIn: '1h' },
    );

    const aiProxyUrl = `${this.forestServerUrl}/liana/v1/ai-proxy`;

    return new ChatOpenAI({
      // Model has no effect — the server uses its own configured model.
      // Set here only because ChatOpenAI requires it.
      model: 'gpt-4.1',
      maxRetries: 2,
      configuration: {
        apiKey: jwt,
        fetch: (_url: RequestInfo | URL, init?: RequestInit) => fetch(aiProxyUrl, init),
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
