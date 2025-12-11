import type { McpConfiguration } from '@forestadmin/ai-proxy';

import { McpServerConfigService } from './types';
import { ForestAdminClientOptionsWithDefaults, ForestAdminServerInterface } from '../types';

export default class McpServerConfigFromApiService implements McpServerConfigService {
  constructor(
    private readonly forestadminServerInterface: ForestAdminServerInterface,
    private readonly options: ForestAdminClientOptionsWithDefaults,
  ) {}

  async getConfiguration(): Promise<McpConfiguration> {
    return this.forestadminServerInterface.getMcpServerConfigs(this.options);
  }
}

export { McpServerConfigService } from './types';
