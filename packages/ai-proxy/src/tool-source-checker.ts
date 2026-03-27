import type { ToolSourceConfig } from './tool-provider-factory';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { createToolProviders } from './tool-provider-factory';

export default class ToolSourceChecker {
  static async check(configs: Record<string, ToolSourceConfig>, logger?: Logger): Promise<true> {
    const providers = createToolProviders(configs, logger);

    try {
      await Promise.all(providers.map(p => p.checkConnection()));

      return true;
    } finally {
      await Promise.allSettled(providers.map(p => p.dispose()));
    }
  }
}
