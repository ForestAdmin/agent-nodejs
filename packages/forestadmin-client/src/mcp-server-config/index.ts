import type { McpServerConfigService, ToolConfig } from './types';
import type { ForestAdminClientOptionsWithDefaults, ForestAdminServerInterface } from '../types';

export default class McpServerConfigFromApiService implements McpServerConfigService {
  constructor(
    private readonly forestadminServerInterface: ForestAdminServerInterface,
    private readonly options: ForestAdminClientOptionsWithDefaults,
  ) {}

  async getConfiguration(): Promise<Record<string, ToolConfig>> {
    return this.forestadminServerInterface.getMcpServerConfigs(this.options);
  }
}

export { McpServerConfigService } from './types';
