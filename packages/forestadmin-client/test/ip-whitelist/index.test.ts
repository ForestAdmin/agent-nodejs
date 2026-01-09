import type { ForestAdminServerInterface } from '../../src/types';

import IpWhiteListService from '../../src/ip-whitelist';
import * as factories from '../__factories__';

describe('IpWhiteListService', () => {
  let mockForestAdminServerInterface: jest.Mocked<ForestAdminServerInterface>;
  const options = factories.forestAdminClientOptions.build();

  beforeEach(() => {
    jest.clearAllMocks();
    mockForestAdminServerInterface =
      factories.forestAdminServerInterface.build() as jest.Mocked<ForestAdminServerInterface>;
  });

  test('should return the ip whitelist configuration', async () => {
    mockForestAdminServerInterface.getIpWhitelistRules.mockResolvedValue({
      data: { attributes: { use_ip_whitelist: true, rules: [] } },
    });

    const service = new IpWhiteListService(mockForestAdminServerInterface, options);
    const configuration = await service.getConfiguration();

    expect(configuration).toStrictEqual({ isFeatureEnabled: true, ipRules: [] });
    expect(mockForestAdminServerInterface.getIpWhitelistRules).toHaveBeenCalledWith({
      envSecret: options.envSecret,
      forestServerUrl: options.forestServerUrl,
    });
  });

  test('should return ip rules when feature is enabled', async () => {
    const rules = [
      { type: 0 as const, ip: '192.168.1.1' },
      { type: 1 as const, ipMinimum: '10.0.0.1', ipMaximum: '10.0.0.255' },
      { type: 2 as const, range: '172.16.0.0/16' },
    ];
    mockForestAdminServerInterface.getIpWhitelistRules.mockResolvedValue({
      data: { attributes: { use_ip_whitelist: true, rules } },
    });

    const service = new IpWhiteListService(mockForestAdminServerInterface, options);
    const configuration = await service.getConfiguration();

    expect(configuration).toStrictEqual({ isFeatureEnabled: true, ipRules: rules });
  });

  test('should return disabled configuration', async () => {
    mockForestAdminServerInterface.getIpWhitelistRules.mockResolvedValue({
      data: { attributes: { use_ip_whitelist: false, rules: [] } },
    });

    const service = new IpWhiteListService(mockForestAdminServerInterface, options);
    const configuration = await service.getConfiguration();

    expect(configuration).toStrictEqual({ isFeatureEnabled: false, ipRules: [] });
  });
});
