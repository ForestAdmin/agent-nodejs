/**
 * Standalone client types - no runtime dependencies.
 * Re-exports shared route types and defines client-specific types.
 */
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from '../routes';

// Re-export shared route types for client usage
export type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
  ChatCompletion,
  AiQueryRequest,
  AiQueryResponse,
  InvokeToolRequest,
  InvokeToolResponse,
  RemoteToolDefinition,
  RemoteToolsResponse,
} from '../routes';

// Client-specific types
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
