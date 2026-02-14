import type Anthropic from '@anthropic-ai/sdk';
import type { AnthropicInput } from '@langchain/anthropic';
import type { ChatOpenAIFields } from '@langchain/openai';
import type OpenAI from 'openai';

// OpenAI type aliases
export type ChatCompletionResponse = OpenAI.Chat.Completions.ChatCompletion;
export type ChatCompletionMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;
export type ChatCompletionToolChoice = OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;

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
    model: OpenAI.ChatModel | (string & NonNullable<unknown>);
  };

/**
 * Anthropic-specific configuration.
 * Extends base with all ChatAnthropic options (temperature, maxTokens, etc.)
 * Supports both `apiKey` (unified) and `anthropicApiKey` (native) for flexibility.
 */
export type AnthropicConfiguration = Omit<BaseAiConfiguration, 'model'> &
  Omit<AnthropicInput, 'model' | 'apiKey'> & {
    provider: 'anthropic';
    model: Anthropic.Messages.Model;
  };

export type AiConfiguration = OpenAiConfiguration | AnthropicConfiguration;
