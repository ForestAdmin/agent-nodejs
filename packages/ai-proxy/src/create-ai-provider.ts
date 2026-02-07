import type { AiProviderDefinition } from '@forestadmin/datasource-toolkit';
import type { AiConfiguration } from './provider';

import { Router } from './router';

export function createAiProvider(config: AiConfiguration): AiProviderDefinition {
  return {
    name: config.name,
    provider: config.provider,
    init(logger) {
      return new Router({ aiConfigurations: [config], logger });
    },
  };
}
