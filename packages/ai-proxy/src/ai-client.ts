import type { McpConfiguration } from './mcp-client';
import type { AiConfiguration } from './provider';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { createBaseChatModel } from './create-base-chat-model';
import { AINotConfiguredError } from './errors';
import getAiConfiguration from './get-ai-configuration';
import McpClient from './mcp-client';
import validateAiConfigurations from './validate-ai-configurations';

// eslint-disable-next-line import/prefer-default-export
export class AiClient {
  private readonly aiConfigurations: AiConfiguration[];
  private readonly logger?: Logger;
  private readonly modelCache = new Map<string, BaseChatModel>();
  private mcpClient?: McpClient;

  constructor(params?: { aiConfigurations?: AiConfiguration[]; logger?: Logger }) {
    this.aiConfigurations = params?.aiConfigurations ?? [];
    this.logger = params?.logger;

    validateAiConfigurations(this.aiConfigurations);
  }

  getModel(aiName?: string): BaseChatModel {
    const config = getAiConfiguration(this.aiConfigurations, aiName, this.logger);
    if (!config) throw new AINotConfiguredError();

    const cached = this.modelCache.get(config.name);
    if (cached) return cached;

    const model = createBaseChatModel(config);
    this.modelCache.set(config.name, model);

    return model;
  }

  async loadRemoteTools(mcpConfig: McpConfiguration): Promise<Awaited<ReturnType<McpClient['loadTools']>>> {
    await this.disposeMcpClient('Error closing previous MCP connection');

    const newClient = new McpClient(mcpConfig, this.logger);
    const tools = await newClient.loadTools();
    this.mcpClient = newClient;

    return tools;
  }

  async closeConnections(): Promise<void> {
    await this.disposeMcpClient('Error during MCP connection cleanup');
  }

  private async disposeMcpClient(errorMessage: string): Promise<void> {
    if (!this.mcpClient) return;

    try {
      await this.mcpClient.dispose();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger?.('Error', errorMessage, err);
    } finally {
      this.mcpClient = undefined;
    }
  }
}
