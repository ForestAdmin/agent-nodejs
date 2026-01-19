import type { RemoteTools } from './remote-tools';
import type { BaseMessageLike } from '@langchain/core/messages';
import type { ChatOpenAIFields } from '@langchain/openai';

import { convertToOpenAIFunction } from '@langchain/core/utils/function_calling';
import { ChatOpenAI } from '@langchain/openai';

import { AINotConfiguredError, OpenAIUnprocessableError } from './types/errors';

export type OpenAiConfiguration = Omit<ChatOpenAIFields, 'model'> & {
  provider: 'openai';
  model: string;
};

export type AiConfiguration = OpenAiConfiguration & {
  name: string;
};

export type AiProvider = AiConfiguration['provider'];

export type Tool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type DispatchBody = {
  tools?: Tool[];
  messages: BaseMessageLike[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
};

export class ProviderDispatcher {
  private readonly chatModel: ChatOpenAI | null = null;

  private readonly remoteTools: RemoteTools;

  constructor(configuration: AiConfiguration | null, remoteTools: RemoteTools) {
    this.remoteTools = remoteTools;

    if (configuration?.provider === 'openai' && configuration.apiKey) {
      const { provider, name, ...chatOpenAIOptions } = configuration;
      this.chatModel = new ChatOpenAI(chatOpenAIOptions);
    }
  }

  async dispatch(body: DispatchBody): Promise<unknown> {
    if (!this.chatModel) {
      throw new AINotConfiguredError();
    }

    const { tools, messages, tool_choice: toolChoice } = body;

    try {
      const enhancedTools = this.enhanceRemoteTools(tools);

      const model =
        enhancedTools && enhancedTools.length > 0
          ? this.chatModel.bindTools(enhancedTools, { tool_choice: toolChoice })
          : this.chatModel;

      const response = await model.invoke(messages);

      const responseMetadata = response.response_metadata as { finish_reason?: string } | undefined;
      const usageMetadata = response.usage_metadata as
        | { input_tokens: number; output_tokens: number; total_tokens: number }
        | undefined;

      // Convert LangChain response to OpenAI-compatible format
      return {
        choices: [
          {
            message: {
              role: 'assistant',
              content: response.content,
              tool_calls: response.tool_calls?.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.args),
                },
              })),
            },
            finish_reason: responseMetadata?.finish_reason || 'stop',
          },
        ],
        usage: usageMetadata
          ? {
              prompt_tokens: usageMetadata.input_tokens,
              completion_tokens: usageMetadata.output_tokens,
              total_tokens: usageMetadata.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      throw new OpenAIUnprocessableError(`Error while calling OpenAI: ${(error as Error).message}`);
    }
  }

  private enhanceRemoteTools(tools?: Tool[]) {
    if (!tools || !Array.isArray(tools)) return tools;

    const remoteToolFunctions = this.remoteTools.tools.map(extendedTools =>
      convertToOpenAIFunction(extendedTools.base),
    );

    return tools.map(tool => {
      const remoteFunction = remoteToolFunctions.find(
        functionDefinition => functionDefinition.name === tool.function.name,
      );
      if (remoteFunction) return { ...tool, function: remoteFunction };

      return tool;
    });
  }
}
