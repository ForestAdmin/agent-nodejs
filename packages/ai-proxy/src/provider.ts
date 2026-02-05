import type { ChatOpenAIFields, OpenAIChatModelId } from '@langchain/openai';
import type OpenAI from 'openai';

// OpenAI type aliases
export type ChatCompletionResponse = OpenAI.Chat.Completions.ChatCompletion;
export type ChatCompletionMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;
export type ChatCompletionToolChoice = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;

// AI Provider types
export type AiProvider = 'openai';

/**
 * Base configuration common to all AI providers.
 */
export type BaseAiConfiguration = {
  name: string;
  provider: AiProvider;
  model: string;
  apiKey?: string;
};

/**
 * OpenAI-specific configuration.
 * Extends base with all ChatOpenAI options (temperature, maxTokens, configuration, etc.)
 */
export type OpenAiConfiguration = BaseAiConfiguration &
  Omit<ChatOpenAIFields, 'model' | 'apiKey'> & {
    provider: 'openai';
    // OpenAIChatModelId provides autocomplete for known models (gpt-4o, gpt-4-turbo, etc.)
    // (string & NonNullable<unknown>) allows custom model strings without losing autocomplete
    model: OpenAIChatModelId | (string & NonNullable<unknown>);
  };

export type AiConfiguration = OpenAiConfiguration;
