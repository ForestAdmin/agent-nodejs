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

  describe('setupAuthentication', () => {
    test('should attach the checkIp method to the router', () => {
      const routerUse = jest.fn();
      const router = factories.router.build({ use: routerUse });
      ipWhitelistService.setupAuthentication(router);

      expect(routerUse).toHaveBeenCalledTimes(1);
      expect(routerUse.mock.calls[0][0].name).toEqual('bound checkIp');
    });
  });

  describe('bootstrap', () => {
    test('shoud reject when forestadmin-server is down', async () => {
      getIpWhitelist.mockRejectedValue(new Error());
      await expect(ipWhitelistService.bootstrap()).rejects.toThrowError();
    });

    test('should resolve when the feature is disabled', async () => {
      getIpWhitelist.mockResolvedValue({ isFeatureEnabled: false });
      await expect(ipWhitelistService.bootstrap()).resolves.not.toThrowError();
    });

    test('should resolve when the feature is enabled', async () => {
      getIpWhitelist.mockResolvedValue({
        isFeatureEnabled: true,
        ipRules: [{ type: 0, ip: '66.66.66.66' }],
      });

      await expect(ipWhitelistService.bootstrap()).resolves.not.toThrowError();
    });
  });

  describe('checkIp', () => {
    describe('when the feature is disabled', () => {
      beforeEach(async () => {
        getIpWhitelist.mockResolvedValue({ isFeatureEnabled: false });
        await ipWhitelistService.bootstrap();
      });

      test('should call next()', async () => {
        const context = {} as unknown as Context;
        const next = jest.fn() as Next;
        await ipWhitelistService.checkIp(context, next);

        expect(next).toHaveBeenCalled();
      });
    });

    describe('when the feature is enabled', () => {
      beforeEach(async () => {
        getIpWhitelist.mockResolvedValue({
          isFeatureEnabled: true,
          ipRules: [{ type: 0, ip: '10.20.15.10' }],
        });

        await ipWhitelistService.bootstrap();
      });

      test('call next() when request.ip is in range (x-forwarded-for not defined)', async () => {
        const context = {
          request: { ip: '10.20.15.10', headers: {} },
        } as unknown as Context;
        const next = jest.fn() as Next;

        await ipWhitelistService.checkIp(context, next);

        expect(next).toHaveBeenCalled();
      });

      test('throw when request.ip is not in range (x-forwarded-for not defined)', async () => {
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

      test('call next() when x-forwarded-for is in range', async () => {
        const context = {
          request: { headers: { 'x-forwarded-for': '10.20.15.10' } },
        } as unknown as Context;
        const next = jest.fn() as Next;
        await ipWhitelistService.checkIp(context, next);

        expect(next).toHaveBeenCalled();
      });

      test('throw when x-forwarded-for is not in range', async () => {
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
