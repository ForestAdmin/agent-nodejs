import type { IpWhitelistConfiguration } from './types';
import type { HttpOptions } from '../permissions/forest-http-api';
import type { ForestAdminClientOptionsWithDefaults, ForestAdminServerInterface } from '../types';

export default class IpWhiteListService {
  constructor(
    private forestAdminServerInterface: ForestAdminServerInterface,
    private options: ForestAdminClientOptionsWithDefaults,
  ) {}

  async getConfiguration(): Promise<IpWhitelistConfiguration> {
    const body = await this.forestAdminServerInterface.getIpWhitelistRules(this.getHttpOptions());

    return {
      isFeatureEnabled: body.data.attributes.use_ip_whitelist,
      ipRules: body.data.attributes.rules,
    };
  }

  private getHttpOptions(): HttpOptions {
    return {
      envSecret: this.options.envSecret,
      forestServerUrl: this.options.forestServerUrl,
    };
  }
}
