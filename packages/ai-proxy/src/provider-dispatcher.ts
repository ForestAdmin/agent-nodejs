import type { RemoteTools } from './remote-tools';
import type { ClientOptions } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

import { AIMessage } from '@langchain/core/messages';
import { ChatMistralAI, ChatMistralAIInput } from '@langchain/mistralai';
import { ChatOpenAI } from '@langchain/openai';

import {
  AINotConfiguredError,
  MistralUnprocessableError,
  OpenAIUnprocessableError,
} from './types/errors';

export type BaseConfiguration = {
  provider: string;
  model: string;
  apiKey: string;
};

export type OpenAiConfiguration = ClientOptions &
  BaseConfiguration & {
    provider: 'openai';
    // (string & NonNullable<unknown>) allows custom models while preserving autocomplete for known models
    model: ChatCompletionCreateParamsNonStreaming['model'] | (string & NonNullable<unknown>);
  };

export type MistralConfiguration = ChatMistralAIInput &
  BaseConfiguration & {
    provider: 'mistral';
  };

export type AiConfiguration = OpenAiConfiguration | MistralConfiguration;

export type AiProvider = AiConfiguration['provider'];

export type OpenAIBody = Pick<
  ChatCompletionCreateParamsNonStreaming,
  'tools' | 'messages' | 'tool_choice'
>;

export type DispatchBody = OpenAIBody;

type LangChainClient = {
  invoke: (messages: unknown) => Promise<AIMessage>;
  bindTools: (tools: unknown, options?: unknown) => LangChainClient;
};

export class ProviderDispatcher {
  private readonly client: LangChainClient | null = null;

  private readonly provider: AiProvider | null = null;

  private readonly model: string;

  private readonly remoteTools: RemoteTools;

  constructor(configuration: AiConfiguration | null, remoteTools: RemoteTools) {
    this.remoteTools = remoteTools;
    this.model = configuration?.model ?? '';
    this.provider = configuration?.provider ?? null;

    if (configuration?.provider === 'openai' && configuration.apiKey) {
      const { provider, model, apiKey, ...clientOptions } = configuration;
      this.client = new ChatOpenAI({
        apiKey,
        model,
        configuration: clientOptions,
      }) as unknown as LangChainClient;
    }

    if (configuration?.provider === 'mistral' && configuration.apiKey) {
      const { provider, ...mistralOptions } = configuration;
      this.client = new ChatMistralAI(mistralOptions) as unknown as LangChainClient;
    }
  }

  async dispatch(body: DispatchBody): Promise<unknown> {
    if (!this.client) {
      throw new AINotConfiguredError();
    }

    const { tools, messages, tool_choice: toolChoice } = body;

    try {
      const enhancedTools = this.enhanceRemoteTools(tools);

      const clientWithTools =
        enhancedTools && enhancedTools.length > 0
          ? this.client.bindTools(enhancedTools, { tool_choice: toolChoice })
          : this.client;

      const response = await clientWithTools.invoke(messages);

      return this.convertAIMessageToOpenAI(response);
    } catch (error) {
      if (this.provider === 'mistral') {
        throw new MistralUnprocessableError(
          `Error while calling Mistral: ${(error as Error).message}`,
        );
      }

      throw new OpenAIUnprocessableError(`Error while calling OpenAI: ${(error as Error).message}`);
    }
  }

  private convertAIMessageToOpenAI(message: AIMessage): unknown {
    const toolCalls = message.tool_calls?.map(tc => ({
      id: tc.id ?? `call_${Date.now()}`,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args),
      },
    }));

    // Usage metadata types vary by provider, use type assertions
    const usageMetadata = message.usage_metadata as
      | { input_tokens?: number; output_tokens?: number; total_tokens?: number }
      | undefined;
    const tokenUsage = (message.response_metadata as { tokenUsage?: Record<string, number> })
      ?.tokenUsage;

    const content = typeof message.content === 'string' ? message.content : null;

    return {
      id: message.id ?? `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
            ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
          },
          finish_reason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
        },
      ],
      usage: {
        prompt_tokens: usageMetadata?.input_tokens ?? tokenUsage?.promptTokens ?? 0,
        completion_tokens: usageMetadata?.output_tokens ?? tokenUsage?.completionTokens ?? 0,
        total_tokens: usageMetadata?.total_tokens ?? tokenUsage?.totalTokens ?? 0,
      },
    };
  }

  private enhanceRemoteTools(tools?: ChatCompletionCreateParamsNonStreaming['tools']) {
    if (!tools || !Array.isArray(tools)) return tools;

    return tools.map(tool => {
      const remoteTool = this.remoteTools.tools.find(rt => rt.base.name === tool.function.name);

      if (remoteTool) {
        return {
          type: 'function' as const,
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
