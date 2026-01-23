import type { AnthropicInput } from '@langchain/anthropic';
import type { ChatOpenAIFields, OpenAIChatModelId } from '@langchain/openai';
import type OpenAI from 'openai';

// OpenAI type aliases
export type ChatCompletionResponse = OpenAI.Chat.Completions.ChatCompletion;
export type ChatCompletionMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;
export type ChatCompletionToolChoice = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;

// Anthropic models
export const ANTHROPIC_MODELS = [
  'claude-sonnet-4-5-20250514',
  'claude-opus-4-20250514',
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-latest',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-latest',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
] as const;

export type AnthropicModel = (typeof ANTHROPIC_MODELS)[number];

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
