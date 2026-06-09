import type { AiConfiguration } from './provider';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';

import { AIBadRequestError } from './errors';

// eslint-disable-next-line import/prefer-default-export
export function createBaseChatModel(config: AiConfiguration): BaseChatModel {
  if (config.provider === 'openai') {
    const { provider, name, ...opts } = config;

    return new ChatOpenAI({ maxRetries: 0, ...opts });
  }

  if (config.provider === 'anthropic') {
    const { provider, name, model, ...opts } = config;

    return new ChatAnthropic({ maxRetries: 0, ...opts, model });
  }

  throw new AIBadRequestError(
    `Unsupported AI provider '${(config as { provider: string }).provider}'.`,
  );
}
