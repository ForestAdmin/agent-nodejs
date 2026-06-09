import type { AiConfiguration } from './provider';

import { AIModelNotSupportedError } from './errors';
import isModelSupportingTools from './supported-models';

export default function validateAiConfigurations(aiConfigurations: AiConfiguration[]): void {
  for (const config of aiConfigurations) {
    if (!isModelSupportingTools(config.model, config.provider)) {
      throw new AIModelNotSupportedError(config.model);
    }
  }
}
