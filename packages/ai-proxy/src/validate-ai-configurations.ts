import type { AiConfiguration } from './provider';

import { AIModelNotAllowlistedError, AIModelNotSupportedError } from './errors';
import isModelSupportingTools from './supported-models';

export default function validateAiConfigurations(aiConfigurations: AiConfiguration[]): void {
  for (const config of aiConfigurations) {
    if (!isModelSupportingTools(config.model, config.provider)) {
      // Bedrock refuses on an allowlist, not on tool capability: telling a Claude 3.5 user their
      // model "does not support tools" sends them hunting for a capability they already had.
      throw config.provider === 'bedrock'
        ? new AIModelNotAllowlistedError(config.model)
        : new AIModelNotSupportedError(config.model);
    }
  }
}
