import type { AIMessage } from '@langchain/core/messages';

/**
 * Extract tool call arguments from an AI response.
 * ai-proxy guarantees a single tool call per response, so this returns
 * the first tool call's args or null if the model returned none.
 */
export default function extractToolCallArgs(response: AIMessage): Record<string, unknown> | null {
  const toolCall = response.tool_calls?.[0];

  return toolCall ? (toolCall.args as Record<string, unknown>) : null;
}
