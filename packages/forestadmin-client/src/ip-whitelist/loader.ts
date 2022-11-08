import { ForestAdminClientOptionsWithDefaults } from '../types';
import ServerUtils from '../utils/server';
import { IpWhitelistConfiguration } from './types';

type RawIpWhiteList = {
  data: {
    attributes: {
      use_ip_whitelist: boolean;
      rules: IpWhitelistConfiguration['ipRules'];
    };
  };
};

export default class IpWhiteListLoader {
  static async getIpWhitelistConfiguration(
    options: ForestAdminClientOptionsWithDefaults,
  ): Promise<IpWhitelistConfiguration> {
    const body = await ServerUtils.query<RawIpWhiteList>(
      options,
      'get',
      '/liana/v1/ip-whitelist-rules',
    );

    return {
      isFeatureEnabled: body.data.attributes.use_ip_whitelist,
      ipRules: body.data.attributes.rules,
    };
  }
}
