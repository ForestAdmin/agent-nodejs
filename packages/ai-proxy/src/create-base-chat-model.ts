import type { AiConfiguration } from './provider';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatBedrockConverse } from '@langchain/aws';
import { ChatOpenAI } from '@langchain/openai';

import { AIBadRequestError } from './errors';

// LangChain infers tool_choice support from a hardcoded family list (claude-3/4, mistral-large)
// and throws client-side for anything else, so every claude-5 id would be rejected before reaching
// AWS. Let Bedrock be the authority instead: a model that truly cannot do it answers with a
// ValidationException, and its id leaves the allowlist in supported-models.ts.
const BEDROCK_TOOL_CHOICE_VALUES = ['auto', 'any', 'tool'] as const;

// LangChain reads AWS_DEFAULT_REGION only, and its own error names just that one — unhelpful to
// anyone who set AWS_REGION, the variable the AWS SDK and CLI treat as primary.
function resolveBedrockRegion(region?: string): string {
  const resolved = region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

  if (!resolved) {
    throw new AIBadRequestError(
      'Bedrock requires a region: set `region` in the AI configuration, AWS_REGION or ' +
        'AWS_DEFAULT_REGION.',
    );
  }

  return resolved;
}

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

  if (config.provider === 'bedrock') {
    const { provider, name, region, ...opts } = config;

    return new ChatBedrockConverse({
      maxRetries: 0,
      supportsToolChoiceValues: [...BEDROCK_TOOL_CHOICE_VALUES],
      ...opts,
      region: resolveBedrockRegion(region),
    });
  }

  throw new AIBadRequestError(
    `Unsupported AI provider '${(config as { provider: string }).provider}'.`,
  );
}
