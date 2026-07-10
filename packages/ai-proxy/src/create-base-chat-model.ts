import type { AiConfiguration } from './provider';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';

import { AIBadRequestError } from './errors';

// eslint-disable-next-line import/prefer-default-export
export function createBaseChatModel(config: AiConfiguration): BaseChatModel {
  if (config.provider === 'openai') {
    const { provider, name, ...opts } = config;

    // Use the Responses API: reasoning models (gpt-5.x) reject tools + reasoning_effort on
    // /v1/chat/completions. A user-supplied useResponsesApi still wins (spread after).
    return new ChatOpenAI({ maxRetries: 0, useResponsesApi: true, ...opts });
  }

  if (config.provider === 'anthropic') {
    const { provider, name, model, ...opts } = config;

    return new ChatAnthropic({ maxRetries: 0, ...opts, model });
  }

  throw new AIBadRequestError(
    `Unsupported AI provider '${(config as { provider: string }).provider}'.`,
  );
}
