import type { RemoteTools } from './remote-tools';
import type { ClientOptions } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import OpenAI from 'openai';

import { OpenAIUnprocessableError } from './errors';

export type OpenAiConfiguration = ClientOptions & {
  name: string;
  provider: 'openai';
  model: string;
};

// Extensible: add MistralConfiguration, AnthropicConfiguration, etc.
export type AiConfiguration = OpenAiConfiguration;

export type AiProvider = AiConfiguration['provider'];

export type OpenAIBody = Pick<
  ChatCompletionCreateParamsNonStreaming,
  'tools' | 'messages' | 'tool_choice'
>;

export type DispatchBody = OpenAIBody;

type OpenAiClient = { client: OpenAI; model: string };

export class ProviderDispatcher {
  private readonly clients: Map<string, OpenAiClient> = new Map();

  private readonly remoteTools: RemoteTools;

  constructor(configurations: AiConfiguration[], remoteTools: RemoteTools) {
    this.remoteTools = remoteTools;

    for (const config of configurations) {
      if (config.provider === 'openai' && config.apiKey) {
        const { name, provider, model, ...clientOptions } = config;
        this.clients.set(name, {
          client: new OpenAI(clientOptions),
          model,
        });
      }
    }
  }

  async dispatch(clientName: string, body: DispatchBody): Promise<unknown> {
    const aiClient = this.clients.get(clientName);

    if (!aiClient) {
      throw new Error(`AI client "${clientName}" is not configured`);
    }

    // tools, messages and tool_choice must be extracted from the body and passed as options
    // because we don't want to let users to pass any other option
    const { tools, messages, tool_choice: toolChoice } = body;

    const options = {
      model: aiClient.model,
      // Add the remote tools to the tools to be used by the AI
      tools: this.enhanceOpenAIRemoteTools(tools),
      messages,
      tool_choice: toolChoice,
    } as ChatCompletionCreateParamsNonStreaming;

    try {
      return await aiClient.client.chat.completions.create(options);
    } catch (error) {
      throw new OpenAIUnprocessableError(
        `Error while calling OpenAI: ${(error as Error).message}`,
      );
    }
  }

  private enhanceOpenAIRemoteTools(tools?: ChatCompletionCreateParamsNonStreaming['tools']) {
    if (!tools || !Array.isArray(tools)) return tools;

    const remoteToolFunctions = this.remoteTools.tools.map(extendedTools =>
      convertToOpenAIFunction(extendedTools.base),
    );

    return tools.map(tool => {
      const remoteFunction = remoteToolFunctions.find(
        functionDefinition => functionDefinition.name === tool.function.name,
      );
      if (remoteFunction) return { ...tool, function: remoteFunction };

      return tool;
    });
  }
}
