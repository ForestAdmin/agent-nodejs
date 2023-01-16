import { IpWhitelistConfiguration } from './types';
import { ForestAdminClientOptionsWithDefaults } from '../types';
import ServerUtils from '../utils/server';

type RawIpWhiteList = {
  data: {
    attributes: {
      use_ip_whitelist: boolean;
      rules: IpWhitelistConfiguration['ipRules'];
    };
  };
};

export default class IpWhiteListService {
  constructor(private options: ForestAdminClientOptionsWithDefaults) {}

  async getConfiguration(): Promise<IpWhitelistConfiguration> {
    const body = await ServerUtils.query<RawIpWhiteList>(
      this.options,
      'get',
      '/liana/v1/ip-whitelist-rules',
    );

    return {
      isFeatureEnabled: body.data.attributes.use_ip_whitelist,
      ipRules: body.data.attributes.rules,
    };
  }
}
