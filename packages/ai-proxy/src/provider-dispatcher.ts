import type { OpenAIMessage } from './langchain-adapter';
import type { AiConfiguration, ChatCompletionResponse, ChatCompletionTool } from './provider';
import type { RemoteTools } from './remote-tools';
import type { DispatchBody } from './schemas/route';
import type { AIMessage, BaseMessageLike } from '@langchain/core/messages';

import { ChatAnthropic } from '@langchain/anthropic';
import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';

import AnthropicAdapter from './anthropic-adapter';
import { AIBadRequestError, AINotConfiguredError, AIUnprocessableError } from './errors';
import { LangChainAdapter } from './langchain-adapter';

// Re-export types for consumers
export type {
  AiConfiguration,
  AiProvider,
  AnthropicConfiguration,
  BaseAiConfiguration,
  ChatCompletionMessage,
  ChatCompletionResponse,
  ChatCompletionTool,
  ChatCompletionToolChoice,
  OpenAiConfiguration,
} from './provider';
export type { DispatchBody } from './schemas/route';

export default class ProviderDispatcher {
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
    } else if (configuration) {
      throw new AIBadRequestError(
        `Unsupported AI provider '${(configuration as { provider: string }).provider}'.`,
      );
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
      ? this.openaiModel.bindTools(enrichedTools, {
          tool_choice: toolChoice,
          parallel_tool_calls: parallelToolCalls,
        })
      : this.openaiModel;

    let response: AIMessage;

    try {
      response = await model.invoke(messages as BaseMessageLike[]);
    } catch (error) {
      throw ProviderDispatcher.wrapProviderError(error, 'OpenAI');
    }

    // eslint-disable-next-line no-underscore-dangle
    const rawResponse = response.additional_kwargs.__raw_response as ChatCompletionResponse;

    if (!rawResponse) {
      throw new AIUnprocessableError(
        'OpenAI response missing raw response data. This may indicate an API change.',
      );
    }

    return rawResponse;
  }

  private async dispatchAnthropic(body: DispatchBody): Promise<ChatCompletionResponse> {
    const {
      tools,
      messages,
      tool_choice: toolChoice,
      parallel_tool_calls: parallelToolCalls,
    } = body;

    // Convert messages outside try-catch so input validation errors propagate directly
    const langChainMessages = AnthropicAdapter.convertMessages(messages as OpenAIMessage[]);
    const enrichedTools = this.enrichToolDefinitions(tools);

    const model = enrichedTools?.length
      ? AnthropicAdapter.bindTools(this.anthropicModel, enrichedTools, {
          toolChoice,
          parallelToolCalls,
        })
      : this.anthropicModel;

    let response: AIMessage;

    try {
      response = (await model.invoke(langChainMessages)) as AIMessage;
    } catch (error) {
      throw ProviderDispatcher.wrapProviderError(error, 'Anthropic');
    }

    return LangChainAdapter.convertResponse(response, this.modelName);
  }

  /**
   * Wraps provider errors into AI-specific error types.
   *
   * TODO: Currently all provider errors are wrapped as AIUnprocessableError,
   * losing the original HTTP semantics (429 rate limit, 401 auth failure).
   * To fix this properly we need to:
   * 1. Add UnauthorizedError and TooManyRequestsError to datasource-toolkit
   * 2. Add corresponding cases in the agent's error-handling middleware
   * 3. Create AIProviderError, AIRateLimitError, AIAuthenticationError in ai-proxy
   *    with baseBusinessErrorName overrides for correct HTTP status mapping
   */
  private static wrapProviderError(error: unknown, providerName: string): Error {
    if (error instanceof AIUnprocessableError) return error;
    if (error instanceof AIBadRequestError) return error;

    if (!(error instanceof Error)) {
      return new AIUnprocessableError(`Error while calling ${providerName}: ${String(error)}`);
    }

    const { status } = error as Error & { status?: number };

    if (status === 429) {
      return new AIUnprocessableError(`${providerName} rate limit exceeded: ${error.message}`, {
        cause: error,
      });
    }

    if (status === 401) {
      return new AIUnprocessableError(`${providerName} authentication failed: ${error.message}`, {
        cause: error,
      });
    }

    return new AIUnprocessableError(`Error while calling ${providerName}: ${error.message}`, {
      cause: error,
    });
  }

  private enrichToolDefinitions(tools?: ChatCompletionTool[]): ChatCompletionTool[] | undefined {
    if (!tools) return tools;

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
