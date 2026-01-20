import type { RemoteTools } from './remote-tools';
import type { BaseMessageLike } from '@langchain/core/messages';
import type { ChatOpenAIFields } from '@langchain/openai';
import type OpenAI from 'openai';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';

import { AINotConfiguredError, OpenAIUnprocessableError } from './types/errors';

/**
 * OpenAI provider configuration.
 */
export type OpenAiConfiguration = Omit<ChatOpenAIFields, 'model'> & {
  provider: 'openai';
  model: string;
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

/**
 * Dispatches AI requests to the configured OpenAI provider.
 *
 * @description
 * Uses LangChain's ChatOpenAI with `__includeRawResponse: true` to get the raw OpenAI response
 * directly, avoiding any response transformation.
 *
 * @see {@link DispatchBody} - Input type (OpenAI Chat Completion format)
 * @see {@link ChatCompletionResponse} - Output type (OpenAI Chat Completion format)
 */
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

    try {
      const enrichedTools = this.enrichToolDefinitions(tools);
      const model = this.bindToolsIfNeeded(this.chatModel, enrichedTools, toolChoice);
      const response = await model.invoke(messages as BaseMessageLike[]);

      // Extract raw OpenAI response (enabled via __includeRawResponse in constructor)
      // eslint-disable-next-line no-underscore-dangle
      return response.additional_kwargs.__raw_response as ChatCompletionResponse;
    } catch (error) {
      throw new OpenAIUnprocessableError(`Error while calling OpenAI: ${(error as Error).message}`);
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
