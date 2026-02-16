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
  tool_call_id?: string;
}

export type OpenAIMessage =
  | OpenAISystemMessage
  | OpenAIUserMessage
  | OpenAIAssistantMessage
  | OpenAIToolMessage;

type LangChainToolChoice = 'auto' | 'any' | 'none' | { type: 'tool'; name: string } | undefined;

/**
 * Extended tool_choice type for Anthropic.
 *
 * LangChain's AnthropicToolChoice doesn't include `disable_parallel_tool_use`,
 * but the Anthropic API supports it and LangChain passes objects through directly.
 */
type AnthropicToolChoiceWithParallelControl =
  | 'auto'
  | 'any'
  | 'none'
  | { type: 'tool'; name: string; disable_parallel_tool_use?: boolean }
  | { type: 'auto' | 'any'; disable_parallel_tool_use: boolean };

/**
 * Handles format conversions between OpenAI and LangChain.
 *
 * Generic methods work with any LangChain-based provider.
 * Anthropic-specific methods handle provider constraints
 * (single system message, disable_parallel_tool_use).
 */
export class LangChainAdapter {
  // ── Generic conversions ─────────────────────────────────────────────

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
                  args: LangChainAdapter.parseToolArguments(
                    tc.function.name,
                    tc.function.arguments,
                  ),
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
      model: modelName,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: LangChainAdapter.extractTextContent(response.content),
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

  // ── Anthropic-specific ──────────────────────────────────────────────

  /**
   * Merge all system messages into a single one placed first.
   *
   * Anthropic only allows a single system message at the beginning of the conversation.
   * This preprocesses OpenAI messages before generic conversion.
   */
  static mergeSystemMessages(messages: OpenAIMessage[]): OpenAIMessage[] {
    const systemContents = messages.filter(m => m.role === 'system').map(m => m.content || '');

    if (systemContents.length <= 1) return messages;

    const merged: OpenAIMessage = { role: 'system', content: systemContents.join('\n\n') };
    const nonSystem = messages.filter(m => m.role !== 'system');

    return [merged, ...nonSystem];
  }

  /**
   * Apply Anthropic's disable_parallel_tool_use constraint to a tool_choice.
   *
   * When parallel_tool_calls is false, Anthropic requires the tool_choice to be
   * an object with `disable_parallel_tool_use: true`.
   */
  static withParallelToolCallsRestriction(
    toolChoice: LangChainToolChoice,
    parallelToolCalls?: boolean,
  ): AnthropicToolChoiceWithParallelControl | undefined {
    if (parallelToolCalls !== false) return toolChoice;

    // Anthropic requires object form to set disable_parallel_tool_use
    if (toolChoice === undefined || toolChoice === 'auto') {
      return { type: 'auto', disable_parallel_tool_use: true };
    }

    if (toolChoice === 'any') {
      return { type: 'any', disable_parallel_tool_use: true };
    }

    if (toolChoice === 'none') return 'none';

    return { ...toolChoice, disable_parallel_tool_use: true };
  }

  // ── Private helpers ─────────────────────────────────────────────────

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

  private static parseToolArguments(toolName: string, args: string): Record<string, unknown> {
    try {
      return JSON.parse(args);
    } catch {
      throw new AIBadRequestError(
        `Invalid JSON in tool_calls arguments for tool '${toolName}': ${args}`,
      );
    }
  }
}
