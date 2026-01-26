/**
 * Standalone client types - no runtime dependencies.
 * Uses OpenAI types via type-only imports (erased at compile time).
 */
import type OpenAI from 'openai';

export type ChatCompletionMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;
export type ChatCompletionToolChoiceOption = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
export type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion;

export interface AiProxyClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
  fetch?: typeof fetch;
}

export interface ChatInput {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  toolChoice?: ChatCompletionToolChoiceOption;
  aiName?: string;
}

export interface RemoteToolDefinition {
  name: string;
  description: string;
  responseFormat: 'content' | 'content_and_artifact';
  schema: Record<string, unknown>;
  sourceId: string;
  sourceType: string;
}

export class AiProxyClientError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'AiProxyClientError';
    this.status = status;
    this.body = body;
  }
}
