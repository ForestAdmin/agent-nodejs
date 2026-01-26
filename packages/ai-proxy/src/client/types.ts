/**
 * Standalone client types - no runtime dependencies.
 * Re-exports shared route types and defines client-specific types.
 */
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from '../types';

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
} from '../types';

// Client-specific types
export interface AiProxyClientConfig {
  baseUrl: string;
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
  readonly cause?: Error;

  constructor(message: string, status: number, body?: unknown, cause?: Error) {
    super(message);
    this.name = 'AiProxyClientError';
    this.status = status;
    this.body = body;
    this.cause = cause;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }
}
