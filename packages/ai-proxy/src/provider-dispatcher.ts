import type { RemoteTools } from './remote-tools';
import type { BaseMessageLike } from '@langchain/core/messages';
import type { ChatOpenAIFields } from '@langchain/openai';
import type OpenAI from 'openai';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';

import { AINotConfiguredError, OpenAIUnprocessableError } from './types/errors';

/**
 * OpenAI provider configuration.
 *
 * @property provider - Must be 'openai'
 * @property model - The model to use (e.g., 'gpt-4o', 'gpt-4-turbo')
 * @property apiKey - Required OpenAI API key
 */
export type OpenAiConfiguration = Omit<ChatOpenAIFields, 'model' | 'apiKey'> & {
  provider: 'openai';
  model: string;
  apiKey: string;
};

/**
 * AI provider configuration with a display name.
 */
export type AiConfiguration = OpenAiConfiguration & {
  name: string;
};

export type AiProvider = AiConfiguration['provider'];

// ============================================================================
// OpenAI Types - Re-exported for convenience
// ============================================================================

/** OpenAI Chat Completion response. */
export type ChatCompletionResponse = OpenAI.Chat.Completions.ChatCompletion;

/** OpenAI Chat Completion message. */
export type ChatCompletionMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** OpenAI Chat Completion tool. */
export type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;

/** OpenAI Chat Completion tool choice. */
export type ChatCompletionToolChoice = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;

/**
 * Request body for the AI dispatch endpoint.
 * Uses OpenAI Chat Completion types.
 */
export type DispatchBody = {
  messages: ChatCompletionMessage[];
  tools?: ChatCompletionTool[];
  tool_choice?: ChatCompletionToolChoice;
};

export class ProviderDispatcher {
  private readonly chatModel: ChatOpenAI | null = null;

  private readonly remoteTools: RemoteTools;

  constructor(configuration: AiConfiguration | null, remoteTools: RemoteTools) {
    this.remoteTools = remoteTools;

    if (configuration?.provider === 'openai' && configuration.apiKey) {
      const { provider, name, ...chatOpenAIOptions } = configuration;
      this.chatModel = new ChatOpenAI({
        ...chatOpenAIOptions,
        __includeRawResponse: true, // Include raw OpenAI response in AIMessage
      });
    }
  }

  /**
   * Dispatches a chat completion request to the configured AI provider.
   *
   * @param body - OpenAI-compatible request body
   * @returns OpenAI-compatible response
   */
  async dispatch(body: DispatchBody): Promise<ChatCompletionResponse> {
    if (!this.chatModel) {
      throw new AINotConfiguredError();
    }

    const { tools, messages, tool_choice: toolChoice } = body;

    const enrichedTools = this.enrichToolDefinitions(tools);
    const model = this.bindToolsIfNeeded(this.chatModel, enrichedTools, toolChoice);

    try {
      const response = await model.invoke(messages as BaseMessageLike[]);

      // Extract raw OpenAI response (enabled via __includeRawResponse in constructor)
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

  /**
   * Enriches tool definitions with full schemas from remote tools.
   * The frontend sends minimal tool definitions; this replaces them with complete schemas.
   */
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
