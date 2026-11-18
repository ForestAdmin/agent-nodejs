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
    .min(1),
  // The model is called without tools, so a caller asking for some would get an answer ignoring them.
  tools: z.array(z.unknown()).max(0).optional(),
});

export function parseCustomerModelRequest(body: unknown): OpenAIMessage[] {
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    throw invalidRequest(
      'An AI query takes messages with a system, user or assistant role and text content, and no tools',
    );
  }

  return parsed.data.messages;
}

export async function queryCustomerModel(
  { model, modelName, timeoutMs }: CustomerModel,
  messages: OpenAIMessage[],
) {
  // Anthropic and Bedrock refuse more than one leading system message; OpenAI takes the merged one.
  const response = await model.invoke(AnthropicAdapter.convertMessages(messages), {
    signal: AbortSignal.timeout(timeoutMs),
  });

  return LangChainAdapter.convertResponse(
    response as Parameters<typeof LangChainAdapter.convertResponse>[0],
    modelName,
  );
}
