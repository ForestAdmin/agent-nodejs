import type { AiConfiguration, ChatCompletionResponse, ChatCompletionTool } from './provider';
import type { RemoteTools } from './remote-tools';
import type { DispatchBody } from './schemas/route';
import type { BaseMessageLike } from '@langchain/core/messages';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';

import { AINotConfiguredError, OpenAIUnprocessableError } from './errors';

// Re-export types for consumers
export type {
  AiConfiguration,
  AiProvider,
  BaseAiConfiguration,
  ChatCompletionMessage,
  ChatCompletionResponse,
  ChatCompletionTool,
  ChatCompletionToolChoice,
  OpenAiConfiguration,
} from './provider';
export type { DispatchBody } from './schemas/route';

export class ProviderDispatcher {
  private readonly chatModel: ChatOpenAI | null = null;

  private readonly remoteTools: RemoteTools;

  constructor(configuration: AiConfiguration | null, remoteTools: RemoteTools) {
    this.remoteTools = remoteTools;

    if (configuration?.provider === 'openai') {
      const { provider, name, ...chatOpenAIOptions } = configuration;
      this.chatModel = new ChatOpenAI({
        maxRetries: 0, // No retries by default - this lib is a passthrough
        ...chatOpenAIOptions,
        __includeRawResponse: true,
      });
    }
  }

  async dispatch(body: DispatchBody): Promise<ChatCompletionResponse> {
    if (!this.chatModel) {
      throw new AINotConfiguredError();
    }

    const {
      tools,
      messages,
      tool_choice: toolChoice,
      parallel_tool_calls: parallelToolCalls,
    } = body;

    const enrichedTools = this.enrichToolDefinitions(tools);
    const model = enrichedTools?.length
      ? this.chatModel.bindTools(enrichedTools, {
          tool_choice: toolChoice,
          parallel_tool_calls: parallelToolCalls,
        })
      : this.chatModel;

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
