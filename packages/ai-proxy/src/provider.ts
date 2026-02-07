import type { AnthropicInput, AnthropicMessagesModelId } from '@langchain/anthropic';
import type { ChatOpenAIFields, OpenAIChatModelId } from '@langchain/openai';
import type OpenAI from 'openai';

// OpenAI type aliases
export type ChatCompletionResponse = OpenAI.Chat.Completions.ChatCompletion;
export type ChatCompletionMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;
export type ChatCompletionToolChoice = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;

// Anthropic model type from langchain (auto-updated when SDK updates)
// Includes known models for autocomplete + allows custom strings
export type AnthropicModel = AnthropicMessagesModelId;

// AI Provider types
export type AiProvider = 'openai' | 'anthropic';

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
export type OpenAiConfiguration = Omit<BaseAiConfiguration, 'model'> &
  Omit<ChatOpenAIFields, 'model' | 'apiKey'> & {
    provider: 'openai';
    // OpenAIChatModelId provides autocomplete for known models (gpt-4o, gpt-4-turbo, etc.)
    // (string & NonNullable<unknown>) allows custom model strings without losing autocomplete
    model: OpenAIChatModelId | (string & NonNullable<unknown>);
  };

/**
 * Anthropic-specific configuration.
 * Extends base with all ChatAnthropic options (temperature, maxTokens, etc.)
 * Supports both `apiKey` (unified) and `anthropicApiKey` (native) for flexibility.
 */
export type AnthropicConfiguration = BaseAiConfiguration &
  Omit<AnthropicInput, 'model' | 'apiKey'> & {
    provider: 'anthropic';
    model: AnthropicModel;
  };

export type AiConfiguration = OpenAiConfiguration | AnthropicConfiguration;
