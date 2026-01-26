/**
 * Shared route types for server and client.
 * This file is the single source of truth for API types.
 */
import type OpenAI from 'openai';

// ============================================
// OpenAI types (re-exported for convenience)
// ============================================
export type ChatCompletionMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;
export type ChatCompletionToolChoiceOption = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
export type ChatCompletion = OpenAI.Chat.Completions.ChatCompletion;

// ============================================
// Route: ai-query
// ============================================
export interface AiQueryRequest {
  messages: ChatCompletionMessageParam[];
  tools?: ChatCompletionTool[];
  tool_choice?: ChatCompletionToolChoiceOption;
}

export interface AiQueryQuery {
  'ai-name'?: string;
}

export type AiQueryResponse = ChatCompletion;

// ============================================
// Route: invoke-remote-tool
// ============================================
export interface InvokeToolRequest {
  inputs: ChatCompletionMessageParam[];
}

export interface InvokeToolQuery {
  'tool-name': string;
}

export type InvokeToolResponse = unknown;

// ============================================
// Route: remote-tools
// ============================================
export interface RemoteToolDefinition {
  name: string;
  description: string;
  responseFormat: 'content' | 'content_and_artifact';
  schema: Record<string, unknown>;
  sourceId: string;
  sourceType: string;
}

export type RemoteToolsResponse = RemoteToolDefinition[];
