import type { IpWhitelistConfiguration } from './types';
import type { ForestAdminClientOptionsWithDefaults, ForestAdminServerInterface } from '../types';

import { toHttpOptions } from '../permissions/forest-http-api';

export default class IpWhiteListService {
  constructor(
    private forestAdminServerInterface: ForestAdminServerInterface,
    private options: ForestAdminClientOptionsWithDefaults,
  ) {}

  async getConfiguration(): Promise<IpWhitelistConfiguration> {
    const body = await this.forestAdminServerInterface.getIpWhitelistRules(
      toHttpOptions(this.options),
    );

    return {
      isFeatureEnabled: body.data.attributes.use_ip_whitelist,
      ipRules: body.data.attributes.rules,
    };
  }
}
