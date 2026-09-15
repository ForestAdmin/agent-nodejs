import type { AiConfiguration } from './provider';

import { AIBadRequestError, AIModelNotAllowlistedError, AIModelNotSupportedError } from './errors';
import isModelSupportingTools from './supported-models';

export default function validateAiConfigurations(aiConfigurations: AiConfiguration[]): void {
  for (const config of aiConfigurations) {
    // The CLI and the embedded option both refuse this, but a direct `new AiClient(...)` reaches
    // neither, and ChatBedrockConverse drops the key silently and authenticates with the ambient
    // role instead — wrong account, wrong bill, no error.
    if (config.provider === 'bedrock' && (config as { apiKey?: string }).apiKey) {
      throw new AIBadRequestError(
        'apiKey is not used with provider bedrock: credentials come from the AWS credential chain. ' +
          'Remove it.',
      );
    }

    if (!isModelSupportingTools(config.model, config.provider)) {
      // Bedrock refuses on an allowlist, not on tool capability: telling a Claude 3.5 user their
      // model "does not support tools" sends them hunting for a capability they already had.
      throw config.provider === 'bedrock'
        ? new AIModelNotAllowlistedError(config.model)
        : new AIModelNotSupportedError(config.model);
    }
  }
}
