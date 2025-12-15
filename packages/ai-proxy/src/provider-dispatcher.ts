import type { RemoteTools } from './remote-tools';
import type { ClientOptions } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatMistralAI } from '@langchain/mistralai';
import OpenAI from 'openai';

import {
  AINotConfiguredError,
  MistralUnprocessableError,
  OpenAIUnprocessableError,
} from './types/errors';

export type OpenAiConfiguration = ClientOptions & {
  provider: 'openai';
  // Allow string to support custom models or new model versions without updating the package
  model: ChatCompletionCreateParamsNonStreaming['model'] | string;
};

export type MistralConfiguration = {
  provider: 'mistral';
  model: string;
  apiKey: string;
};

export type AiConfiguration = OpenAiConfiguration | MistralConfiguration;

export type AiProvider = AiConfiguration['provider'];

export type OpenAIBody = Pick<
  ChatCompletionCreateParamsNonStreaming,
  'tools' | 'messages' | 'tool_choice'
>;

export type DispatchBody = OpenAIBody;

type OpenAiClient = { client: OpenAI; model: ChatCompletionCreateParamsNonStreaming['model'] };
type MistralClient = { client: ChatMistralAI; model: string };

export class ProviderDispatcher {
  private readonly openAiClient: OpenAiClient | null = null;

  private readonly mistralClient: MistralClient | null = null;

  private readonly remoteTools: RemoteTools;

  constructor(configuration: AiConfiguration | null, remoteTools: RemoteTools) {
    this.remoteTools = remoteTools;

    if (configuration?.provider === 'openai' && configuration.apiKey) {
      const { provider, model, ...clientOptions } = configuration;
      this.openAiClient = {
        client: new OpenAI(clientOptions),
        model,
      };
    }

    if (configuration?.provider === 'mistral' && configuration.apiKey) {
      const { model, apiKey } = configuration;
      this.mistralClient = {
        client: new ChatMistralAI({ apiKey, model }),
        model,
      };
    }
  }

  async dispatch(body: DispatchBody): Promise<unknown> {
    if (this.openAiClient) {
      return this.dispatchOpenAI(body);
    }

    if (this.mistralClient) {
      return this.dispatchMistral(body);
    }

    throw new AINotConfiguredError();
  }

  private async dispatchOpenAI(body: DispatchBody): Promise<unknown> {
    const { tools, messages, tool_choice: toolChoice } = body;

    const options = {
      model: this.openAiClient.model,
      tools: this.enhanceOpenAIRemoteTools(tools),
      messages,
      tool_choice: toolChoice,
    } as ChatCompletionCreateParamsNonStreaming;

    try {
      return await this.openAiClient.client.chat.completions.create(options);
    } catch (error) {
      throw new OpenAIUnprocessableError(`Error while calling OpenAI: ${(error as Error).message}`);
    }
  }

  private async dispatchMistral(body: DispatchBody): Promise<unknown> {
    const { tools, messages, tool_choice: toolChoice } = body;

    try {
      const mistralTools = this.enhanceMistralRemoteTools(tools);

      let { client } = this.mistralClient as {
        client: { invoke: (messages: unknown) => Promise<unknown> };
      };

      if (mistralTools && mistralTools.length > 0) {
        client = this.mistralClient.client.bindTools(mistralTools, {
          tool_choice: toolChoice as 'auto' | 'any' | 'none',
        });
      }

      const response = await client.invoke(messages);

      return this.serializeAIMessage(response);
    } catch (error) {
      throw new MistralUnprocessableError(
        `Error while calling Mistral: ${(error as Error).message}`,
      );
    }
  }

  private serializeAIMessage(response: unknown): unknown {
    const aiMessage = response as {
      content: string;
      tool_calls?: Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
      }>;
      response_metadata?: {
        tokenUsage?: {
          completionTokens: number;
          promptTokens: number;
          totalTokens: number;
        };
      };
    };

    const toolCalls = aiMessage.tool_calls?.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.args),
      },
    }));

    return {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.mistralClient?.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: aiMessage.content || null,
            ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
          },
          finish_reason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
        },
      ],
      usage: aiMessage.response_metadata?.tokenUsage
        ? {
            prompt_tokens: aiMessage.response_metadata.tokenUsage.promptTokens,
            completion_tokens: aiMessage.response_metadata.tokenUsage.completionTokens,
            total_tokens: aiMessage.response_metadata.tokenUsage.totalTokens,
          }
        : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };
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

  private enhanceMistralRemoteTools(tools?: ChatCompletionCreateParamsNonStreaming['tools']) {
    if (!tools || !Array.isArray(tools)) return tools;

    return tools.map(tool => {
      const remoteTool = this.remoteTools.tools.find(
        extendedTool => extendedTool.base.name === tool.function.name,
      );

      if (remoteTool) {
        return {
          ...tool,
          function: {
            name: remoteTool.base.name,
            description: remoteTool.base.description,
            parameters: remoteTool.base.schema,
          },
        };
      }

      return tool;
    });
  }
}
