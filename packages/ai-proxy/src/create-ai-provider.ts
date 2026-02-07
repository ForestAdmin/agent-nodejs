import type { AiConfiguration } from './provider';
import type { AiProviderDefinition } from '@forestadmin/datasource-toolkit';

import { Router } from './router';

// eslint-disable-next-line import/prefer-default-export
export function createAiProvider(config: AiConfiguration): AiProviderDefinition {
  return {
    providers: [{ name: config.name, provider: config.provider }],
    init(logger) {
      return new Router({ aiConfigurations: [config], logger });
    },
  };
}
