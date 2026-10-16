import type { ChatCompletionResponse, ChatCompletionToolChoice } from './provider';
import type { BaseMessage } from '@langchain/core/messages';

import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import crypto from 'crypto';

import { AIBadRequestError } from './errors';

interface OpenAISystemMessage {
  role: 'system';
  content: string | null;
}

interface OpenAIUserMessage {
  role: 'user';
  content: string | null;
}

interface OpenAIAssistantMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface OpenAIToolMessage {
  role: 'tool';
  content: string | null;
  tool_call_id: string;
}

export type OpenAIMessage =
  | OpenAISystemMessage
  | OpenAIUserMessage
  | OpenAIAssistantMessage
  | OpenAIToolMessage;

export type LangChainToolChoice =
  | 'auto'
  | 'any'
  | 'none'
  | { type: 'tool'; name: string }
  | undefined;

interface UsageMetadata {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_token_details?: { cache_read?: number };
  output_token_details?: { reasoning?: number };
}

// What LangChain keeps of an OpenAI Responses API result; no other provider sets `object`.
interface ResponseMetadata {
  object?: string;
  created_at?: number;
  model_name?: string;
  incomplete_details?: { reason?: string };
}

/** Handles generic format conversions between OpenAI and LangChain. */
export class LangChainAdapter {
  /** Convert OpenAI-format messages to LangChain messages. */
  static convertMessages(messages: OpenAIMessage[]): BaseMessage[] {
    const result: BaseMessage[] = [];

    for (const msg of messages) {
      switch (msg.role) {
        case 'system':
          result.push(new SystemMessage(msg.content || ''));
          break;
        case 'user':
          result.push(new HumanMessage(msg.content || ''));
          break;
        case 'assistant':
          if (msg.tool_calls) {
            result.push(
              new AIMessage({
                content: msg.content || '',
                tool_calls: msg.tool_calls.map(tc => ({
                  id: tc.id,
                  name: tc.function.name,
                  args: LangChainAdapter.parseToolArguments(tc.function.arguments),
                })),
              }),
            );
          } else {
            result.push(new AIMessage(msg.content || ''));
          }

          break;
        case 'tool':
          if (!msg.tool_call_id) {
            throw new AIBadRequestError('Tool message is missing required "tool_call_id" field.');
          }

          result.push(
            new ToolMessage({
              content: msg.content || '',
              tool_call_id: msg.tool_call_id,
            }),
          );
          break;
        default:
          throw new AIBadRequestError(
            `Unsupported message role '${
              (msg as { role: string }).role
            }'. Expected: system, user, assistant, or tool.`,
          );
      }
    }

    return result;
  }

  /** Convert a LangChain AIMessage to an OpenAI-compatible ChatCompletionResponse. */
  static convertResponse(response: AIMessage, modelName: string | null): ChatCompletionResponse {
    const toolCalls = [
      ...(response.tool_calls ?? []).map(tc => ({
        id: tc.id || `call_${crypto.randomUUID()}`,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args),
        },
      })),
      // A call whose arguments are not valid JSON still reaches the caller, who can report it.
      ...(response.invalid_tool_calls ?? []).map(tc => ({
        id: tc.id || `call_${crypto.randomUUID()}`,
        type: 'function' as const,
        function: {
          name: tc.name ?? '',
          arguments: tc.args ?? '',
        },
      })),
    ];

    const usageMetadata = response.usage_metadata as UsageMetadata | undefined;
    const metadata = response.response_metadata as ResponseMetadata | undefined;
    const isResponsesApi = metadata?.object === 'response';
    const refusal = response.additional_kwargs?.refusal;
    const cachedTokens = usageMetadata?.input_token_details?.cache_read;
    const reasoningTokens = usageMetadata?.output_token_details?.reasoning;

    return {
      id: response.id || `msg_${crypto.randomUUID()}`,
      object: 'chat.completion',
      created:
        isResponsesApi && typeof metadata.created_at === 'number'
          ? metadata.created_at
          : Math.floor(Date.now() / 1000),
      model: (isResponsesApi && metadata.model_name) || modelName,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: LangChainAdapter.extractTextContent(response.content),
            refusal: typeof refusal === 'string' ? refusal : null,
            tool_calls: toolCalls.length ? toolCalls : undefined,
          },
          finish_reason: LangChainAdapter.finishReasonOf(metadata, toolCalls.length > 0),
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: usageMetadata?.input_tokens ?? 0,
        completion_tokens: usageMetadata?.output_tokens ?? 0,
        total_tokens: usageMetadata?.total_tokens ?? 0,
        ...(typeof cachedTokens === 'number' && {
          prompt_tokens_details: { cached_tokens: cachedTokens },
        }),
        ...(typeof reasoningTokens === 'number' && {
          completion_tokens_details: { reasoning_tokens: reasoningTokens },
        }),
      },
    };
  }

  /** Convert OpenAI tool_choice to LangChain format. */
  static convertToolChoice(toolChoice: ChatCompletionToolChoice | undefined): LangChainToolChoice {
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

  // An answer cut short stays cut short even when it carries tool calls: their arguments may be
  // incomplete, as Chat Completions reports it.
  private static finishReasonOf(
    metadata: ResponseMetadata | undefined,
    hasToolCalls: boolean,
  ): 'stop' | 'length' | 'content_filter' | 'tool_calls' {
    switch (metadata?.incomplete_details?.reason) {
      case 'max_output_tokens':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return hasToolCalls ? 'tool_calls' : 'stop';
    }
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

  // Arguments that are not valid JSON are what a relayed invalid tool call leaves in the history,
  // and the next turn must still go through.
  private static parseToolArguments(args: string): Record<string, unknown> {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }

  /** Replace tool call arguments that are not valid JSON, so the provider's SDK accepts the history. */
  static withParsableToolArguments<T>(messages: T[]): T[] {
    return messages.map(message => {
      const { tool_calls: toolCalls } = message as { tool_calls?: unknown };

      if (!Array.isArray(toolCalls)) return message;

      return {
        ...message,
        tool_calls: toolCalls.map(toolCall => {
          const args = toolCall?.function?.arguments;

          if (typeof args !== 'string' || LangChainAdapter.isJson(args)) return toolCall;

          return { ...toolCall, function: { ...toolCall.function, arguments: '{}' } };
        }),
      };
    });
  }

  private static isJson(value: string): boolean {
    try {
      JSON.parse(value);

      return true;
    } catch {
      return false;
    }
  }
}
