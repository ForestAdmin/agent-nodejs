import type { AiConfiguration } from './provider';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { ChatAnthropic } from '@langchain/anthropic';
import { ChatBedrockConverse } from '@langchain/aws';
import { ChatOpenAI } from '@langchain/openai';

import { AIBadRequestError } from './errors';

// LangChain only infers tool_choice support for a hardcoded list of model families (claude-3/4,
// mistral-large) and throws client-side for anything else — Nova, Llama and any newer Claude would
// be rejected before reaching AWS. Callers always bind tools with `tool_choice: 'any'`, so we let
// Bedrock be the authority: a model that really cannot do it answers with a ValidationException,
// and its id goes to the denylist in supported-models.ts.
const BEDROCK_TOOL_CHOICE_VALUES = ['auto', 'any', 'tool'] as const;

// LangChain falls back to AWS_DEFAULT_REGION only, but ECS/EKS/Lambda set AWS_REGION.
function resolveBedrockRegion(region?: string): string | undefined {
  return region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
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
