import type { RemoteTools } from './remote-tools';
import type { ClientOptions } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

import { AIMessage } from '@langchain/core/messages';
import { ChatMistralAI, ChatMistralAIInput } from '@langchain/mistralai';
import { ChatOpenAI } from '@langchain/openai';

import {
  AIMissingApiKeyError,
  AINotConfiguredError,
  AIUnsupportedProviderError,
  MistralUnprocessableError,
  OpenAIUnprocessableError,
} from './types/errors';

// Utility type to preserve autocomplete for known values while allowing custom strings
type WithAutocomplete<T extends string> = T | (string & NonNullable<unknown>);

// Known Mistral model names for autocomplete
type KnownMistralModels =
  | 'mistral-large-latest'
  | 'mistral-small-latest'
  | 'mistral-medium-latest'
  | 'open-mistral-7b'
  | 'open-mixtral-8x7b'
  | 'open-mixtral-8x22b'
  | 'codestral-latest'
  | 'ministral-8b-latest'
  | 'ministral-3b-latest';

const SUPPORTED_PROVIDERS = ['openai', 'mistral'] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export type OpenAiConfiguration = Omit<ClientOptions, 'apiKey'> & {
  provider: 'openai';
  apiKey: string;
  // (string & NonNullable<unknown>) allows custom models while preserving autocomplete for known models
  model: WithAutocomplete<ChatCompletionCreateParamsNonStreaming['model']>;
};

export type MistralConfiguration = Omit<ChatMistralAIInput, 'model' | 'apiKey'> & {
  provider: 'mistral';
  apiKey: string;
  model: WithAutocomplete<KnownMistralModels>;
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

    if (!configuration) {
      return;
    }

    // Validate provider is supported
    if (!SUPPORTED_PROVIDERS.includes(configuration.provider as SupportedProvider)) {
      throw new AIUnsupportedProviderError(configuration.provider);
    }

    // Validate API key is provided
    if (!configuration.apiKey) {
      throw new AIMissingApiKeyError(configuration.provider);
    }

    if (configuration.provider === 'openai') {
      const { provider, model, apiKey, ...clientOptions } = configuration;
      this.client = new ChatOpenAI({
        apiKey,
        model,
        configuration: clientOptions,
      }) as unknown as LangChainClient;
    }

    if (configuration.provider === 'mistral') {
      const { provider, ...mistralOptions } = configuration;
      this.client = new ChatMistralAI(mistralOptions) as unknown as LangChainClient;
    }
  }

  async dispatch(body: DispatchBody): Promise<unknown> {
    if (!this.client) {
      throw new AINotConfiguredError();
    }

    const { tools, messages, tool_choice: toolChoice } = body;

    // Tool enhancement happens outside try-catch - if it fails, it's a programming error
    const enhancedTools = this.enhanceRemoteTools(tools);

    const clientWithTools =
      enhancedTools && enhancedTools.length > 0
        ? this.client.bindTools(enhancedTools, { tool_choice: toolChoice })
        : this.client;

    let response: AIMessage;

    try {
      response = await clientWithTools.invoke(messages);
    } catch (error) {
      const providerName = this.provider === 'mistral' ? 'Mistral' : 'OpenAI';
      const errorMessage = (error as Error).message;
      const ErrorClass =
        this.provider === 'mistral' ? MistralUnprocessableError : OpenAIUnprocessableError;

      const wrappedError = new ErrorClass(`Error while calling ${providerName}: ${errorMessage}`);
      wrappedError.cause = error;
      throw wrappedError;
    }

    return this.convertAIMessageToOpenAI(response);
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
      const toolName = tool?.function?.name;
      const remoteTool = toolName
        ? this.remoteTools.tools.find(rt => rt.base.name === toolName)
        : null;

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
