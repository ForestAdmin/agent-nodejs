import type { RemoteTools } from './remote-tools';
import type { BaseMessageLike } from '@langchain/core/messages';
import type { ChatOpenAIFields, OpenAIChatModelId } from '@langchain/openai';
import type OpenAI from 'openai';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';

import { AINotConfiguredError, OpenAIUnprocessableError } from './types/errors';

/**
 * OpenAI model prefixes that support function calling (tools).
 * Models not in this list will be rejected.
 * @see https://platform.openai.com/docs/guides/function-calling
 */
const OPENAI_MODELS_WITH_TOOLS_SUPPORT = [
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4.1',
  'gpt-4',
  'gpt-3.5-turbo',
  'o1',
  'o3',
  'o4',
];

export function isModelSupportingTools(model: string): boolean {
  return OPENAI_MODELS_WITH_TOOLS_SUPPORT.some(
    supported => model === supported || model.startsWith(`${supported}-`),
  );
}

export type OpenAiConfiguration = Omit<ChatOpenAIFields, 'model' | 'apiKey'> & {
  provider: 'openai';
  // OpenAIChatModelId provides autocomplete for known models (gpt-4o, gpt-4-turbo, etc.)
  // (string & NonNullable<unknown>) allows custom model strings without losing autocomplete
  model: OpenAIChatModelId | (string & NonNullable<unknown>);
  apiKey: string;
};

export type AiConfiguration = OpenAiConfiguration & {
  name: string;
};

export type AiProvider = AiConfiguration['provider'];

export type ChatCompletionResponse = OpenAI.Chat.Completions.ChatCompletion;
export type ChatCompletionMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;
export type ChatCompletionToolChoice = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;

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
        __includeRawResponse: true,
      });
    }
  }

  async dispatch(body: DispatchBody): Promise<ChatCompletionResponse> {
    if (!this.chatModel) {
      throw new AINotConfiguredError();
    }

    const { tools, messages, tool_choice: toolChoice } = body;

    const enrichedTools = this.enrichToolDefinitions(tools);
    const model = this.bindToolsIfNeeded(this.chatModel, enrichedTools, toolChoice);

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
