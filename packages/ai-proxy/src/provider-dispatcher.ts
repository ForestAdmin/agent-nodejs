import type { RemoteTools } from './remote-tools';
import type { AnthropicInput } from '@langchain/anthropic';
import type { BaseMessage, BaseMessageLike } from '@langchain/core/messages';
import type { ChatOpenAIFields, OpenAIChatModelId } from '@langchain/openai';
import type OpenAI from 'openai';

import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';

import {
  AINotConfiguredError,
  AnthropicUnprocessableError,
  OpenAIUnprocessableError,
} from './types/errors';

export const ANTHROPIC_MODELS = [
  'claude-sonnet-4-5-20250514',
  'claude-opus-4-20250514',
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-latest',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-latest',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
] as const;

export type AnthropicModel = (typeof ANTHROPIC_MODELS)[number];

/**
 * OpenAI model prefixes that do NOT support function calling (tools).
 * Unknown models are allowed.
 * @see https://platform.openai.com/docs/guides/function-calling
 */
const OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT = [
  'gpt-4',
  'gpt-3.5-turbo',
  'gpt-3.5',
  'text-davinci',
  'davinci',
  'curie',
  'babbage',
  'ada',
];

/**
 * Exceptions to the unsupported list - these models DO support tools
 * even though they start with an unsupported prefix.
 */
const OPENAI_MODELS_EXCEPTIONS = ['gpt-4-turbo', 'gpt-4o', 'gpt-4.1'];

export function isModelSupportingTools(model: string): boolean {
  const isException = OPENAI_MODELS_EXCEPTIONS.some(
    exception => model === exception || model.startsWith(`${exception}-`),
  );
  if (isException) return true;

  const isKnownUnsupported = OPENAI_MODELS_WITHOUT_TOOLS_SUPPORT.some(
    unsupported => model === unsupported || model.startsWith(`${unsupported}-`),
  );

  return !isKnownUnsupported;
}

/**
 * Base configuration common to all AI providers.
 */
export type BaseAiConfiguration = {
  name: string;
  provider: AiProvider;
  model: string;
  apiKey?: string;
};

/**
 * OpenAI-specific configuration.
 * Extends base with all ChatOpenAI options (temperature, maxTokens, configuration, etc.)
 */
export type OpenAiConfiguration = BaseAiConfiguration &
  Omit<ChatOpenAIFields, 'model' | 'apiKey'> & {
    provider: 'openai';
    // OpenAIChatModelId provides autocomplete for known models (gpt-4o, gpt-4-turbo, etc.)
    // (string & NonNullable<unknown>) allows custom model strings without losing autocomplete
    model: OpenAIChatModelId | (string & NonNullable<unknown>);
  };

/**
 * Anthropic-specific configuration.
 * Extends base with all ChatAnthropic options (temperature, maxTokens, etc.)
 * Supports both `apiKey` (unified) and `anthropicApiKey` (native) for flexibility.
 */
export type AnthropicConfiguration = BaseAiConfiguration &
  Omit<AnthropicInput, 'model' | 'apiKey'> & {
    provider: 'anthropic';
    model: AnthropicModel;
  };

export type AiProvider = 'openai' | 'anthropic';
export type AiConfiguration = OpenAiConfiguration | AnthropicConfiguration;

export type ChatCompletionResponse = OpenAI.Chat.Completions.ChatCompletion;
export type ChatCompletionMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;
export type ChatCompletionToolChoice = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;

export type DispatchBody = {
  messages: ChatCompletionMessage[];
  tools?: ChatCompletionTool[];
  tool_choice?: ChatCompletionToolChoice;
};

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

export class ProviderDispatcher {
  private readonly openaiModel: ChatOpenAI | null = null;

  private readonly anthropicModel: ChatAnthropic | null = null;

  private readonly modelName: string | null = null;

  private readonly remoteTools: RemoteTools;

  constructor(configuration: AiConfiguration | null, remoteTools: RemoteTools) {
    this.remoteTools = remoteTools;

    if (configuration?.provider === 'openai') {
      const { provider, name, ...chatOpenAIOptions } = configuration;
      this.openaiModel = new ChatOpenAI({
        ...chatOpenAIOptions,
        __includeRawResponse: true,
      });
    } else if (configuration?.provider === 'anthropic') {
      const { provider, name, model, ...clientOptions } = configuration;
      this.anthropicModel = new ChatAnthropic({
        ...clientOptions,
        model,
      });
      this.modelName = model;
    }
  }

  async dispatch(body: DispatchBody): Promise<ChatCompletionResponse> {
    if (this.openaiModel) {
      return this.dispatchOpenAI(body);
    }

    if (this.anthropicModel) {
      return this.dispatchAnthropic(body);
    }

    throw new AINotConfiguredError();
  }

  private async dispatchOpenAI(body: DispatchBody): Promise<ChatCompletionResponse> {
    const { tools, messages, tool_choice: toolChoice } = body;

    const enrichedTools = this.enrichToolDefinitions(tools);
    const model = this.bindToolsIfNeeded(this.openaiModel!, enrichedTools, toolChoice);

    try {
      const response = await model.invoke(messages as BaseMessageLike[]);

      // eslint-disable-next-line no-underscore-dangle
      const rawResponse = response.additional_kwargs.__raw_response as ChatCompletionResponse;

      if (!rawResponse) {
        throw new OpenAIUnprocessableError(
          'OpenAI response missing raw response data. This may indicate an API change.',
        );
      }

      return rawResponse;
    } catch (error) {
      if (error instanceof OpenAIUnprocessableError) throw error;

      const err = error as Error & { status?: number };

      if (err.status === 429) {
        throw new OpenAIUnprocessableError(`Rate limit exceeded: ${err.message}`);
      }

      if (err.status === 401) {
        throw new OpenAIUnprocessableError(`Authentication failed: ${err.message}`);
      }

      throw new OpenAIUnprocessableError(`Error while calling OpenAI: ${err.message}`);
    }
  }

  private async dispatchAnthropic(body: DispatchBody): Promise<ChatCompletionResponse> {
    const { tools, messages, tool_choice: toolChoice } = body;

    try {
      const langChainMessages = this.convertMessagesToLangChain(messages as OpenAIMessage[]);
      const enhancedTools = tools ? this.enrichToolDefinitions(tools) : undefined;
      let response: AIMessage;

      if (enhancedTools?.length) {
        const langChainTools = this.convertToolsToLangChain(enhancedTools);
        const clientWithTools = this.anthropicModel!.bindTools(langChainTools, {
          tool_choice: this.convertToolChoiceToLangChain(toolChoice),
        });
        response = await clientWithTools.invoke(langChainMessages);
      } else {
        response = await this.anthropicModel!.invoke(langChainMessages);
      }

      return this.convertLangChainResponseToOpenAI(response);
    } catch (error) {
      throw new AnthropicUnprocessableError(
        `Error while calling Anthropic: ${(error as Error).message}`,
      );
    }
  }

  private bindToolsIfNeeded(
    chatModel: ChatOpenAI,
    tools: ChatCompletionTool[] | undefined,
    toolChoice?: ChatCompletionToolChoice,
  ) {
    if (!tools || tools.length === 0) {
      return chatModel;
    }

    return chatModel.bindTools(tools, {
      tool_choice: toolChoice as 'auto' | 'none' | 'required' | undefined,
    });
  }

  private convertMessagesToLangChain(messages: OpenAIMessage[]): BaseMessage[] {
    return messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content || '');
        case 'user':
          return new HumanMessage(msg.content || '');
        case 'assistant':
          if (msg.tool_calls) {
            return new AIMessage({
              content: msg.content || '',
              tool_calls: msg.tool_calls.map(tc => ({
                id: tc.id,
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments),
              })),
            });
          }

          return new AIMessage(msg.content || '');
        case 'tool':
          return new ToolMessage({
            content: msg.content || '',
            tool_call_id: msg.tool_call_id!,
          });
        default:
          return new HumanMessage(msg.content || '');
      }
    });
  }

  private convertToolsToLangChain(tools: ChatCompletionTool[]): Array<{
    type: 'function';
    function: { name: string; description?: string; parameters?: Record<string, unknown> };
  }> {
    return tools
      .filter((tool): tool is ChatCompletionTool & { type: 'function' } => tool.type === 'function')
      .map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters as Record<string, unknown> | undefined,
        },
      }));
  }

  private convertToolChoiceToLangChain(
    toolChoice: ChatCompletionToolChoice | undefined,
  ): 'auto' | 'any' | 'none' | { type: 'tool'; name: string } | undefined {
    if (!toolChoice) return undefined;
    if (toolChoice === 'auto') return 'auto';
    if (toolChoice === 'none') return 'none';
    if (toolChoice === 'required') return 'any';

    if (typeof toolChoice === 'object' && toolChoice.type === 'function') {
      return { type: 'tool', name: toolChoice.function.name };
    }

    return undefined;
  }

  private convertLangChainResponseToOpenAI(response: AIMessage): ChatCompletionResponse {
    const toolCalls = response.tool_calls?.map(tc => ({
      id: tc.id || `call_${Date.now()}`,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.args),
      },
    }));

    const usageMetadata = response.usage_metadata as
      | { input_tokens?: number; output_tokens?: number; total_tokens?: number }
      | undefined;

    return {
      id: response.id || `msg_${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.modelName!,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: typeof response.content === 'string' ? response.content : null,
            refusal: null,
            tool_calls: toolCalls?.length ? toolCalls : undefined,
          },
          finish_reason: toolCalls?.length ? 'tool_calls' : 'stop',
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: usageMetadata?.input_tokens || 0,
        completion_tokens: usageMetadata?.output_tokens || 0,
        total_tokens: usageMetadata?.total_tokens || 0,
      },
    };
  }

  private enrichToolDefinitions(tools?: ChatCompletionTool[]) {
    if (!tools || !Array.isArray(tools)) return tools;

    const remoteToolSchemas = this.remoteTools.tools.map(remoteTool =>
      convertToOpenAIFunction(remoteTool.base),
    );

    return tools.map(tool => {
      if (tool.type !== 'function') return tool;

      const remoteSchema = remoteToolSchemas.find(schema => schema.name === tool.function.name);
      if (remoteSchema) return { ...tool, function: remoteSchema };

      return tool;
    });
  }
}
