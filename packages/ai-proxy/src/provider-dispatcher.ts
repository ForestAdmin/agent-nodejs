import type { RemoteTools } from './remote-tools';
import type {
  AiQueryRequest,
  AiQueryResponse,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from './routes';
import type { BaseMessageLike } from '@langchain/core/messages';
import type { ChatOpenAIFields, OpenAIChatModelId } from '@langchain/openai';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';

import { AINotConfiguredError, OpenAIUnprocessableError } from './types/errors';

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

export type AiProvider = 'openai';
export type AiConfiguration = OpenAiConfiguration;

export class ProviderDispatcher {
  private readonly chatModel: ChatOpenAI | null = null;

  private readonly remoteTools: RemoteTools;

  constructor(configuration: AiConfiguration | null, remoteTools: RemoteTools) {
    this.remoteTools = remoteTools;

    if (configuration?.provider === 'openai') {
      const { provider, name, ...chatOpenAIOptions } = configuration;
      this.chatModel = new ChatOpenAI({
        ...chatOpenAIOptions,
        __includeRawResponse: true,
      });
    }
  }

  async dispatch(body: AiQueryRequest): Promise<AiQueryResponse> {
    if (!this.chatModel) {
      throw new AINotConfiguredError();
    }

    const { tools, messages, tool_choice: toolChoice } = body;

    const enrichedTools = this.enrichToolDefinitions(tools);
    const model = this.bindToolsIfNeeded(this.chatModel, enrichedTools, toolChoice);

    try {
      const response = await model.invoke(messages as BaseMessageLike[]);

      // eslint-disable-next-line no-underscore-dangle
      const rawResponse = response.additional_kwargs.__raw_response as AiQueryResponse;

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
    toolChoice?: ChatCompletionToolChoiceOption,
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
