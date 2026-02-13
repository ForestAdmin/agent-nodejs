import type {
  AiConfiguration,
  ChatCompletionResponse,
  ChatCompletionTool,
  ChatCompletionToolChoice,
} from './provider';
import type { RemoteTools } from './remote-tools';
import type { DispatchBody } from './schemas/route';
import type { BaseMessage, BaseMessageLike } from '@langchain/core/messages';

import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';
import crypto from 'crypto';

import {
  AIBadRequestError,
  AINotConfiguredError,
  AnthropicUnprocessableError,
  OpenAIUnprocessableError,
} from './errors';

// Re-export types for consumers
export type {
  AiConfiguration,
  AiProvider,
  AnthropicConfiguration,
  AnthropicModel,
  BaseAiConfiguration,
  ChatCompletionMessage,
  ChatCompletionResponse,
  ChatCompletionTool,
  ChatCompletionToolChoice,
  OpenAiConfiguration,
} from './provider';
export type { DispatchBody } from './schemas/route';

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
        maxRetries: 0, // No retries by default - this lib is a passthrough
        ...chatOpenAIOptions,
        __includeRawResponse: true,
      });
    } else if (configuration?.provider === 'anthropic') {
      const { provider, name, model, ...clientOptions } = configuration;
      this.anthropicModel = new ChatAnthropic({
        maxRetries: 0, // No retries by default - this lib is a passthrough
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
    const {
      tools,
      messages,
      tool_choice: toolChoice,
      parallel_tool_calls: parallelToolCalls,
    } = body;

    const enrichedTools = this.enrichToolDefinitions(tools);
    const model = enrichedTools?.length
      ? this.openaiModel!.bindTools(enrichedTools, {
          tool_choice: toolChoice,
          parallel_tool_calls: parallelToolCalls,
        })
      : this.openaiModel!;

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
      throw ProviderDispatcher.wrapProviderError(error, OpenAIUnprocessableError, 'OpenAI');
    }
  }

  private async dispatchAnthropic(body: DispatchBody): Promise<ChatCompletionResponse> {
    const {
      tools,
      messages,
      tool_choice: toolChoice,
      parallel_tool_calls: parallelToolCalls,
    } = body;

    // Convert messages outside try-catch so input validation errors propagate directly
    const langChainMessages = this.convertMessagesToLangChain(messages as OpenAIMessage[]);
    const enhancedTools = tools ? this.enrichToolDefinitions(tools) : undefined;

    try {
      // `as any` is needed because LangChain's AnthropicToolChoice type doesn't include
      // disable_parallel_tool_use, but the Anthropic API supports it and LangChain passes it through
      const model = enhancedTools?.length
        ? this.anthropicModel!.bindTools(enhancedTools, {
            tool_choice: this.convertToolChoiceForAnthropic(toolChoice, parallelToolCalls) as any,
          })
        : this.anthropicModel!;

      const response = (await model.invoke(langChainMessages)) as AIMessage;

      return this.convertLangChainResponseToOpenAI(response);
    } catch (error) {
      throw ProviderDispatcher.wrapProviderError(error, AnthropicUnprocessableError, 'Anthropic');
    }
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
                args: ProviderDispatcher.parseToolArguments(
                  tc.function.name,
                  tc.function.arguments,
                ),
              })),
            });
          }

          return new AIMessage(msg.content || '');
        case 'tool':
          if (!msg.tool_call_id) {
            throw new AIBadRequestError('Tool message is missing required "tool_call_id" field.');
          }

          return new ToolMessage({
            content: msg.content || '',
            tool_call_id: msg.tool_call_id,
          });
        default:
          throw new AIBadRequestError(
            `Unsupported message role '${msg.role}'. Expected: system, user, assistant, or tool.`,
          );
      }
    });
  }

  private static parseToolArguments(toolName: string, args: string): Record<string, unknown> {
    try {
      return JSON.parse(args);
    } catch {
      throw new AIBadRequestError(
        `Invalid JSON in tool_calls arguments for tool '${toolName}': ${args}`,
      );
    }
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

    throw new AIBadRequestError(
      `Unsupported tool_choice value. Expected: 'auto', 'none', 'required', or {type: 'function', function: {name: '...'}}.`,
    );
  }

  /**
   * Convert tool_choice to Anthropic format, supporting disable_parallel_tool_use.
   *
   * When parallel_tool_calls is false, Anthropic requires the tool_choice to be
   * an object with `disable_parallel_tool_use: true`.
   * LangChain passes objects through directly to the Anthropic API.
   */
  private convertToolChoiceForAnthropic(
    toolChoice: ChatCompletionToolChoice | undefined,
    parallelToolCalls?: boolean,
  ) {
    const base = this.convertToolChoiceToLangChain(toolChoice);

    if (parallelToolCalls !== false) return base;

    // Anthropic requires object form to set disable_parallel_tool_use
    if (base === undefined || base === 'auto') {
      return { type: 'auto', disable_parallel_tool_use: true };
    }

    if (base === 'any') {
      return { type: 'any', disable_parallel_tool_use: true };
    }

    if (base === 'none') return 'none';

    return { ...base, disable_parallel_tool_use: true };
  }

  private static extractTextContent(content: AIMessage['content']): string | null {
    if (typeof content === 'string') return content || null;

    if (Array.isArray(content)) {
      const text = content
        .filter(block => block.type === 'text')
        .map(block => ('text' in block ? block.text : ''))
        .join('');

      return text || null;
    }

    return null;
  }

  private convertLangChainResponseToOpenAI(response: AIMessage): ChatCompletionResponse {
    const toolCalls = response.tool_calls?.map(tc => ({
      id: tc.id || `call_${crypto.randomUUID()}`,
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
      id: response.id || `msg_${crypto.randomUUID()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.modelName!,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: ProviderDispatcher.extractTextContent(response.content),
            refusal: null,
            tool_calls: toolCalls?.length ? toolCalls : undefined,
          },
          finish_reason: toolCalls?.length ? 'tool_calls' : 'stop',
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: usageMetadata?.input_tokens ?? 0,
        completion_tokens: usageMetadata?.output_tokens ?? 0,
        total_tokens: usageMetadata?.total_tokens ?? 0,
      },
    };
  }

  private static wrapProviderError(
    error: unknown,
    ErrorClass: typeof OpenAIUnprocessableError | typeof AnthropicUnprocessableError,
    providerName: string,
  ): Error {
    if (error instanceof ErrorClass) return error;
    if (error instanceof AIBadRequestError) return error;

    const err = error as Error & { status?: number };

    if (err.status === 429) return new ErrorClass(`Rate limit exceeded: ${err.message}`);
    if (err.status === 401) return new ErrorClass(`Authentication failed: ${err.message}`);

    return new ErrorClass(`Error while calling ${providerName}: ${err.message}`);
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
