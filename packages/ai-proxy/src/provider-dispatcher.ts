import type { RemoteTools } from './remote-tools';
import type { ClientOptions } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import { ChatMistralAI, ChatMistralAIInput } from '@langchain/mistralai';
import { ChatOpenAI } from '@langchain/openai';

import {
  AIMissingApiKeyError,
  AINotConfiguredError,
  AIUnsupportedProviderError,
  MistralUnprocessableError,
  OpenAIUnprocessableError,
} from './types/errors';

/**
 * Utility type that preserves IDE autocomplete for known values while allowing custom strings.
 * The `(string & NonNullable<unknown>)` pattern prevents TypeScript from collapsing
 * the union to just `string`, which would lose autocomplete for known values.
 *
 * @example
 * type Model = WithAutocomplete<'gpt-4' | 'gpt-3.5-turbo'>;
 * // Provides autocomplete for 'gpt-4' and 'gpt-3.5-turbo', but also accepts 'gpt-4-turbo'
 */
type WithAutocomplete<T extends string> = T | (string & NonNullable<unknown>);

// Known Mistral model names for autocomplete
// See: https://docs.mistral.ai/getting-started/models/models_overview
type KnownMistralModels =
  // Premier models (latest aliases)
  | 'mistral-large-latest'
  | 'mistral-medium-latest'
  | 'mistral-small-latest'
  | 'codestral-latest'
  // Generalist models
  | 'ministral-8b-latest'
  | 'ministral-3b-latest'
  // Reasoning models
  | 'magistral-medium-latest'
  | 'magistral-small-latest'
  // Free tier models
  | 'pixtral-12b-latest'
  | 'open-mistral-nemo';

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

export class ProviderDispatcher {
  private readonly client: BaseChatModel | null = null;

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

    // Validate provider is supported (using explicit check for proper type narrowing)
    const { provider: configProvider } = configuration;

    if (configProvider !== 'openai' && configProvider !== 'mistral') {
      throw new AIUnsupportedProviderError(configProvider);
    }

    // Validate API key is provided and not empty
    if (!configuration.apiKey?.trim()) {
      throw new AIMissingApiKeyError(configuration.provider);
    }

    if (configuration.provider === 'openai') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { provider, model, apiKey, ...clientOptions } = configuration;
      this.client = new ChatOpenAI({
        apiKey,
        model,
        configuration: clientOptions,
      });
    }

    if (configuration.provider === 'mistral') {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { provider, ...mistralOptions } = configuration;
      this.client = new ChatMistralAI(mistralOptions);
    }
  }

  async dispatch(body: DispatchBody): Promise<unknown> {
    if (!this.client) {
      throw new AINotConfiguredError();
    }

    const { tools, messages, tool_choice: toolChoice } = body;

    // Tool enhancement happens outside try-catch - if it fails, it's a programming error
    const enhancedTools = this.enhanceRemoteTools(tools);

    // Convert OpenAI tool_choice to Mistral format
    // OpenAI uses "required" while Mistral uses "any" to force tool use
    const normalizedToolChoice =
      this.provider === 'mistral' && toolChoice === 'required' ? 'any' : toolChoice;

    // Bind tools to the client if provided
    const clientWithTools =
      enhancedTools && enhancedTools.length > 0
        ? this.client.bindTools(enhancedTools, { tool_choice: normalizedToolChoice })
        : this.client;

    // Debug logging for Mistral tool issues
    if (this.provider === 'mistral' && enhancedTools && enhancedTools.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[AI-Proxy] Mistral tools:', JSON.stringify(enhancedTools, null, 2));
      // eslint-disable-next-line no-console
      console.log('[AI-Proxy] Mistral tool_choice:', normalizedToolChoice);
    }

    try {
      // LangChain clients accept OpenAI message format and convert internally
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await clientWithTools.invoke(messages as any);

      // Debug logging for Mistral responses
      if (this.provider === 'mistral') {
        // eslint-disable-next-line no-console
        console.log('[AI-Proxy] Mistral response:', JSON.stringify(response, null, 2).slice(0, 2000));
      }

      return this.convertAIMessageToOpenAI(response);
    } catch (error) {
      const providerName = this.provider === 'mistral' ? 'Mistral' : 'OpenAI';
      const errorMessage = error instanceof Error ? error.message : String(error);
      const ErrorClass =
        this.provider === 'mistral' ? MistralUnprocessableError : OpenAIUnprocessableError;

      const wrappedError = new ErrorClass(`Error while calling ${providerName}: ${errorMessage}`);
      wrappedError.cause = error;
      throw wrappedError;
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
            // Convert Zod schema to JSON Schema for LLM compatibility
            parameters: toJsonSchema(remoteTool.base.schema),
          },
        };
      }

      // Ensure all tools have a non-empty description (Mistral requires it)
      if (tool?.function && !tool.function.description?.trim()) {
        return {
          ...tool,
          function: {
            ...tool.function,
            description: `Tool: ${tool.function.name}`,
          },
        };
      }

      return tool;
    });
  }
}
