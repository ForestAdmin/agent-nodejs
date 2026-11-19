import type { BaseChatModel, OpenAIMessage } from '@forestadmin/ai-proxy';

import { AnthropicAdapter, LangChainAdapter } from '@forestadmin/ai-proxy';
import { z } from 'zod';

import { invalidRequest } from '../http/bff-local-errors';

export interface CustomerModel {
  model: Pick<BaseChatModel, 'invoke'>;
  modelName: string;
  timeoutMs: number;
}

const requestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() }))
    .min(1)
    // Anthropic and Bedrock refuse a conversation not opening with its system message, and the
    // adapter only merges system messages when there are several.
    .refine(messages => messages.findIndex(({ role }) => role === 'system') <= 0),
  // The model is called without tools, so a caller asking for some would get an answer ignoring them.
  tools: z.array(z.unknown()).max(0).optional(),
});

export function parseCustomerModelRequest(body: unknown): OpenAIMessage[] {
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    throw invalidRequest(
      'An AI query takes messages with a system, user or assistant role and text content, ' +
        'a system message opening the conversation, and no tools',
    );
  }

  return parsed.data.messages;
}

export async function queryCustomerModel(
  { model, modelName, timeoutMs }: CustomerModel,
  messages: OpenAIMessage[],
) {
  const signal = AbortSignal.timeout(timeoutMs);
  let response: unknown;

  try {
    // Anthropic and Bedrock refuse more than one leading system message; OpenAI takes the merged one.
    response = await model.invoke(AnthropicAdapter.convertMessages(messages), { signal });
  } catch (error) {
    // Bedrock and OpenAI report the abort as an AbortError: the signal's own reason says it timed out.
    throw signal.aborted ? signal.reason : error;
  }

  return LangChainAdapter.convertResponse(
    response as Parameters<typeof LangChainAdapter.convertResponse>[0],
    modelName,
  );
}
