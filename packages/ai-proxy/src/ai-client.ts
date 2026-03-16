import type { McpConfiguration } from './mcp-client';
import type { AiConfiguration } from './provider';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { createBaseChatModel } from './create-base-chat-model';
import { AINotConfiguredError } from './errors';
import McpClient from './mcp-client';

// eslint-disable-next-line import/prefer-default-export
export class AiClient {
  private readonly aiConfigurations: AiConfiguration[];
  private readonly logger?: Logger;
  private readonly modelCache = new Map<string, BaseChatModel>();
  private mcpClient?: McpClient;

  constructor(params?: { aiConfigurations?: AiConfiguration[]; logger?: Logger }) {
    this.aiConfigurations = params?.aiConfigurations ?? [];
    this.logger = params?.logger;
  }

  getModel(aiName?: string): BaseChatModel {
    const config = this.getAiConfiguration(aiName);
    if (!config) throw new AINotConfiguredError();

    const cached = this.modelCache.get(config.name);
    if (cached) return cached;

    const model = createBaseChatModel(config);
    this.modelCache.set(config.name, model);

    return model;
  }

  async loadRemoteTools(mcpConfig: McpConfiguration): Promise<McpClient['tools']> {
    if (this.mcpClient) {
      try {
        await this.mcpClient.closeConnections();
      } catch (error) {
        this.logger?.(
          'Error',
          'Error closing previous MCP connection',
          error instanceof Error ? error : new Error(String(error)),
        );
      } finally {
        this.mcpClient = undefined;
      }
    }

    this.mcpClient = new McpClient(mcpConfig, this.logger);

    return this.mcpClient.loadTools();
  }

  async closeConnections(): Promise<void> {
    if (!this.mcpClient) return;

    try {
      await this.mcpClient.closeConnections();
    } catch (cleanupError) {
      const err = cleanupError instanceof Error ? cleanupError : new Error(String(cleanupError));
      this.logger?.('Error', 'Error during MCP connection cleanup', err);
    } finally {
      this.mcpClient = undefined;
    }
  }

  private getAiConfiguration(aiName?: string): AiConfiguration | null {
    if (this.aiConfigurations.length === 0) return null;

    if (aiName) {
      const config = this.aiConfigurations.find(c => c.name === aiName);

      if (!config) {
        const fallback = this.aiConfigurations[0];
        this.logger?.(
          'Warn',
          `AI configuration '${aiName}' not found. Falling back to '${fallback.name}' (provider: ${fallback.provider}, model: ${fallback.model})`,
        );

        return fallback;
      }

      return config;
    }

    return this.aiConfigurations[0];
  }
}
