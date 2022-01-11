import { Context, Next } from 'koa';
import IpWhitelist from '../../src/routes/ip-whitelist';
import { HttpCode } from '../../src/types';
import factories from '../__factories__';

describe('IpWhitelist', () => {
  let getIpWhitelist: jest.Mock;
  let ipWhitelistService: IpWhitelist;

  beforeEach(() => {
    getIpWhitelist = jest.fn();
    const services = factories.forestAdminHttpDriverServices.build({
      forestHTTPApi: { getIpWhitelist },
    });
    const dataSource = factories.dataSource.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    ipWhitelistService = new IpWhitelist(services, dataSource, options);
  });

  describe('Always', () => {
    test('setupAuthentication should attach the checkIp method to the router', () => {
      const routerUse = jest.fn();
      const router = factories.router.build({ use: routerUse });
      ipWhitelistService.setupAuthentication(router);

      expect(routerUse).toHaveBeenCalledTimes(1);
      expect(routerUse.mock.calls[0][0].name).toEqual('bound checkIp');
    });
  });

  describe('if forestadmin-server is down', () => {
    beforeEach(() => {
      getIpWhitelist.mockRejectedValue(new Error());
    });

    test('bootstrap should reject', async () => {
      await expect(ipWhitelistService.bootstrap()).rejects.toThrowError();
    });
  });

  describe('if the feature is disabled', () => {
    beforeEach(() => {
      getIpWhitelist.mockResolvedValue({ isFeatureEnabled: false });
    });

    test('bootstrap should resolve', async () => {
      getIpWhitelist.mockResolvedValue({ isFeatureEnabled: false });
      await expect(ipWhitelistService.bootstrap()).resolves.not.toThrowError();
    });

    test('checkIp should call next()', async () => {
      const context = {} as unknown as Context;
      const next = jest.fn() as Next;

      await ipWhitelistService.checkIp(context, next);

      expect(next).toHaveBeenCalled();
    });

    describe('and the route bootstraped', () => {
      beforeEach(async () => {
        getIpWhitelist.mockResolvedValue({ isFeatureEnabled: false });
        await ipWhitelistService.bootstrap();
      });

      test('checkIp should call next()', async () => {
        const context = {} as unknown as Context;
        const next = jest.fn() as Next;

        await ipWhitelistService.checkIp(context, next);

        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('if the feature is enabled', () => {
    beforeEach(() => {
      getIpWhitelist.mockResolvedValue({
        isFeatureEnabled: true,
        ipRules: [{ type: 0, ip: '10.20.15.10' }],
      });
    });

    test('bootstrap should resolve', async () => {
      await expect(ipWhitelistService.bootstrap()).resolves.not.toThrowError();
    });

    describe('and the route bootstraped', () => {
      beforeEach(async () => {
        await ipWhitelistService.bootstrap();
      });

      test('checkIp should call next() if request.ip is valid (no x-forwarded-for)', async () => {
        const context = {
          request: { ip: '10.20.15.10', headers: {} },
        } as unknown as Context;
        const next = jest.fn() as Next;

        await ipWhitelistService.checkIp(context, next);

        expect(next).toHaveBeenCalled();
      });

      test('checkIp should call next() if x-forwarded-for is valid', async () => {
        const context = {
          request: { headers: { 'x-forwarded-for': '10.20.15.10' } },
        } as unknown as Context;
        const next = jest.fn() as Next;
        await ipWhitelistService.checkIp(context, next);

        expect(next).toHaveBeenCalled();
      });

      test('checkIp should throw if request.ip is invalid (no x-forwarded-for)', async () => {
        const context = {
          throw: jest.fn(),
          request: { ip: '192.168.0.1', headers: {} },
        } as unknown as Context;
        const next = jest.fn() as Next;

        await ipWhitelistService.checkIp(context, next);

        expect(next).not.toHaveBeenCalled();
        expect(context.throw).toHaveBeenCalledWith(
          HttpCode.Forbidden,
          `IP address rejected (192.168.0.1)`,
        );
      });

      test('checkIp should throw if x-forwarded-for is invalid', async () => {
        const context = {
          throw: jest.fn(),
          request: { headers: { 'x-forwarded-for': '192.168.0.1' } },
        } as unknown as Context;
        const next = jest.fn() as Next;

        await ipWhitelistService.checkIp(context, next);

        expect(next).not.toHaveBeenCalled();
        expect(context.throw).toHaveBeenCalledWith(
          HttpCode.Forbidden,
          `IP address rejected (192.168.0.1)`,
        );
      });
    });
  });
});
