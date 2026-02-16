import type { OpenAIMessage } from './langchain-adapter';
import type { ChatCompletionTool, ChatCompletionToolChoice } from './provider';
import type { ChatAnthropic } from '@langchain/anthropic';
import type { BaseMessage } from '@langchain/core/messages';

import { LangChainAdapter } from './langchain-adapter';

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

export default class AnthropicAdapter {
  static convertMessages(messages: OpenAIMessage[]): BaseMessage[] {
    return LangChainAdapter.convertMessages(AnthropicAdapter.mergeSystemMessages(messages));
  }

  /**
   * Bind tools to an Anthropic model with proper tool_choice conversion.
   *
   * Encapsulates the `as string` cast workaround: `convertToolChoice` may return an object
   * with `disable_parallel_tool_use`, which LangChain's AnthropicToolChoice type doesn't
   * support. The `| string` arm in LangChain's type union lets the object pass through at
   * runtime.
   */
  static bindTools(
    model: ChatAnthropic,
    tools: ChatCompletionTool[],
    {
      toolChoice,
      parallelToolCalls,
    }: { toolChoice?: ChatCompletionToolChoice; parallelToolCalls?: boolean },
  ): ChatAnthropic {
    return model.bindTools(tools, {
      tool_choice: AnthropicAdapter.convertToolChoice({ toolChoice, parallelToolCalls }) as string,
    }) as ChatAnthropic;
  }

  /**
   * Convert OpenAI tool_choice to Anthropic format, applying parallel tool restriction.
   *
   * Converts to LangChain format first, then applies `disable_parallel_tool_use`
   * when `parallelToolCalls` is false.
   */
  private static convertToolChoice({
    toolChoice,
    parallelToolCalls,
  }: {
    toolChoice?: ChatCompletionToolChoice;
    parallelToolCalls?: boolean;
  } = {}): AnthropicToolChoiceWithParallelControl | undefined {
    const base = LangChainAdapter.convertToolChoice(toolChoice);

    if (parallelToolCalls !== false) return base;

    // Anthropic requires object form to set disable_parallel_tool_use
    if (base === undefined || base === 'auto') {
      return { type: 'auto', disable_parallel_tool_use: true };
    }

    if (base === 'any') {
      return { type: 'any', disable_parallel_tool_use: true };
    }

    if (base === 'none') return 'none';

    return { ...base, disable_parallel_tool_use: true };
  }

  /**
   * Merge all system messages into a single one placed first.
   *
   * Anthropic only allows a single system message at the beginning of the conversation.
   */
  private static mergeSystemMessages(messages: OpenAIMessage[]): OpenAIMessage[] {
    const systemContents = messages.filter(m => m.role === 'system').map(m => m.content || '');

    if (systemContents.length <= 1) return messages;

    const merged: OpenAIMessage = { role: 'system', content: systemContents.join('\n\n') };
    const nonSystem = messages.filter(m => m.role !== 'system');

    return [merged, ...nonSystem];
  }
}
