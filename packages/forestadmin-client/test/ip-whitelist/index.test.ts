import IpWhiteListService from '../../src/ip-whitelist';
import ServerUtils from '../../src/utils/server';
import * as factories from '../__factories__';

jest.mock('../../src/utils/server', () => ({ query: jest.fn() }));

const serverQueryMock = ServerUtils.query as jest.Mock;

describe('Ip Whitelist loader', () => {
  const options = factories.forestAdminClientOptions.build();

  test('should return the ip whitelist configuration', async () => {
    serverQueryMock.mockResolvedValueOnce({
      data: { attributes: { use_ip_whitelist: true, rules: [] } },
    });

    const configuration = await new IpWhiteListService(options).getConfiguration();

    expect(configuration).toStrictEqual({ isFeatureEnabled: true, ipRules: [] });
    expect(ServerUtils.query).toHaveBeenCalledWith(options, 'get', '/liana/v1/ip-whitelist-rules');
  });
});
