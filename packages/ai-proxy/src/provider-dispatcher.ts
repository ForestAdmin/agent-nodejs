import type { RemoteTools } from './remote-tools';
import type { ClientOptions } from 'openai';
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';

import { Mistral } from '@mistralai/mistralai';
import OpenAI from 'openai';

import {
  AINotConfiguredError,
  MistralUnprocessableError,
  OpenAIUnprocessableError,
} from './types/errors';

export type OpenAiConfiguration = ClientOptions & {
  provider: 'openai';
  model: ChatCompletionCreateParamsNonStreaming['model'] | string;
};

export type MistralConfiguration = {
  provider: 'mistral';
  model: string;
  apiKey: string;
};

export type AiConfiguration = OpenAiConfiguration | MistralConfiguration;

export type AiProvider = AiConfiguration['provider'];

export type OpenAIBody = Pick<
  ChatCompletionCreateParamsNonStreaming,
  'tools' | 'messages' | 'tool_choice'
>;

export type DispatchBody = OpenAIBody;

export class ProviderDispatcher {
  private readonly openAiClient: OpenAI | null = null;

  private readonly mistralClient: Mistral | null = null;

  private readonly model: string;

  private readonly remoteTools: RemoteTools;

  constructor(configuration: AiConfiguration | null, remoteTools: RemoteTools) {
    this.remoteTools = remoteTools;
    this.model = configuration?.model ?? '';

    if (configuration?.provider === 'openai' && configuration.apiKey) {
      const { provider, model, ...clientOptions } = configuration;
      this.openAiClient = new OpenAI(clientOptions);
    }

    if (configuration?.provider === 'mistral' && configuration.apiKey) {
      this.mistralClient = new Mistral({ apiKey: configuration.apiKey });
    }
  }

  async dispatch(body: DispatchBody): Promise<unknown> {
    if (this.openAiClient) {
      return this.dispatchOpenAI(body);
    }

    if (this.mistralClient) {
      return this.dispatchMistral(body);
    }

    throw new AINotConfiguredError();
  }

  private async dispatchOpenAI(body: DispatchBody): Promise<unknown> {
    const { tools, messages, tool_choice: toolChoice } = body;

    try {
      return await this.openAiClient!.chat.completions.create({
        model: this.model,
        tools: this.enhanceRemoteTools(tools),
        messages,
        tool_choice: toolChoice,
      } as ChatCompletionCreateParamsNonStreaming);
    } catch (error) {
      throw new OpenAIUnprocessableError(`Error while calling OpenAI: ${(error as Error).message}`);
    }
  }

  private async dispatchMistral(body: DispatchBody): Promise<unknown> {
    const { tools, messages, tool_choice: toolChoice } = body;

    try {
      const response = await this.mistralClient!.chat.complete({
        model: this.model,
        tools: this.enhanceRemoteTools(tools) as Parameters<
          typeof this.mistralClient.chat.complete
        >[0]['tools'],
        messages: messages as Parameters<typeof this.mistralClient.chat.complete>[0]['messages'],
        toolChoice: toolChoice as 'auto' | 'none' | 'required',
      });

      return this.convertMistralToOpenAI(response);
    } catch (error) {
      throw new MistralUnprocessableError(
        `Error while calling Mistral: ${(error as Error).message}`,
      );
    }
  }

  private convertMistralToOpenAI(response: unknown): unknown {
    const mistralResponse = response as {
      id?: string;
      model?: string;
      choices?: Array<{
        index?: number;
        message?: {
          role?: string;
          content?: string | null;
          toolCalls?: Array<{
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
        finishReason?: string;
      }>;
      usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      };
    };

    return {
      id: mistralResponse.id ?? `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: mistralResponse.model ?? this.model,
      choices: (mistralResponse.choices ?? []).map(choice => ({
        index: choice.index ?? 0,
        message: {
          role: choice.message?.role ?? 'assistant',
          content: choice.message?.content ?? null,
          ...(choice.message?.toolCalls && choice.message.toolCalls.length > 0
            ? {
                tool_calls: choice.message.toolCalls.map(tc => ({
                  id: tc.id,
                  type: 'function',
                  function: {
                    name: tc.function?.name,
                    arguments: tc.function?.arguments,
                  },
                })),
              }
            : {}),
        },
        finish_reason: this.convertFinishReason(choice.finishReason),
      })),
      usage: {
        prompt_tokens: mistralResponse.usage?.promptTokens ?? 0,
        completion_tokens: mistralResponse.usage?.completionTokens ?? 0,
        total_tokens: mistralResponse.usage?.totalTokens ?? 0,
      },
    };
  }

  private convertFinishReason(reason?: string): string {
    if (reason === 'tool_calls') return 'tool_calls';
    if (reason === 'stop') return 'stop';
    if (reason === 'length') return 'length';

    return 'stop';
  }

  private enhanceRemoteTools(tools?: ChatCompletionCreateParamsNonStreaming['tools']) {
    if (!tools || !Array.isArray(tools)) return tools;

    return tools.map(tool => {
      const remoteTool = this.remoteTools.tools.find(rt => rt.base.name === tool.function.name);

      if (remoteTool) {
        return {
          type: 'function' as const,
          function: {
            name: remoteTool.base.name,
            description: remoteTool.base.description,
            parameters: remoteTool.base.schema,
          },
        };
      }

      return tool;
    });
  }
}
