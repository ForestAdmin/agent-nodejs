import type { AiConfiguration } from './provider';
import type RemoteTool from './remote-tool';
import type { ToolProvider } from './tool-provider';
import type { ToolConfig } from './tool-provider-factory';
import type { Logger } from '@forestadmin/datasource-toolkit';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { createBaseChatModel } from './create-base-chat-model';
import { AINotConfiguredError } from './errors';
import getAiConfiguration from './get-ai-configuration';
import { createToolProviders } from './tool-provider-factory';
import validateAiConfigurations from './validate-ai-configurations';

// eslint-disable-next-line import/prefer-default-export
export class AiClient {
  private readonly aiConfigurations: AiConfiguration[];
  private readonly logger?: Logger;
  private readonly modelCache = new Map<string, BaseChatModel>();
  private toolProviders: ToolProvider[] = [];

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

  async loadRemoteTools(configs: Record<string, ToolConfig>): Promise<RemoteTool[]> {
    await this.disposeToolProviders('Error closing previous remote tool connection');

    const providers = createToolProviders(configs, this.logger);
    const toolsByProvider = await Promise.all(providers.map(p => p.loadTools()));
    this.toolProviders = providers;

    return toolsByProvider.flat();
  }

  async closeConnections(): Promise<void> {
    await this.disposeToolProviders('Error during remote tool connection cleanup');
  }

  private async disposeToolProviders(errorMessage: string): Promise<void> {
    if (this.toolProviders.length === 0) return;

    const providers = this.toolProviders;
    this.toolProviders = [];

    const results = await Promise.allSettled(providers.map(p => p.dispose()));

    results.forEach(result => {
      if (result.status === 'rejected') {
        const { reason } = result;
        const err = reason instanceof Error ? reason : new Error(String(reason));
        this.logger?.('Error', errorMessage, err);
      }
    });
  }
}
