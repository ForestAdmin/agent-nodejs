import { Context, Next } from 'koa';
import IpWhitelist from '../../src/routes/ip-whitelist';
import * as factories from '../__factories__';
import { HttpCode } from '../../src/types';

describe('IpWhitelist', () => {
  describe('setupAuthentication', () => {
    test('should attach the checkIp method to the router', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const dataSource = factories.dataSource.build();
      const options = factories.forestAdminHttpDriverOptions.build();

      const ipWhitelistService = new IpWhitelist(services, dataSource, options);

      const router = factories.router.build();
      router.use = jest.fn();

      ipWhitelistService.setupAuthentication(router);

      expect((router.use as jest.Mock).mock.calls[0][0].name).toEqual('bound checkIp');
    });
  });

  describe('bootstrap', () => {
    describe('when the http call succeeds', () => {
      test('should not throw an error ', async () => {
        const services = factories.forestAdminHttpDriverServices.build();
        const dataSource = factories.dataSource.build();
        const options = factories.forestAdminHttpDriverOptions.build();

        services.forestHTTPApi.getIpWhitelist = jest.fn().mockResolvedValue({
          isFeatureEnabled: true,
          ipRules: [],
        });

        const ipWhitelistService = new IpWhitelist(services, dataSource, options);
        await expect(ipWhitelistService.bootstrap()).resolves.not.toThrowError();
      });
    });

    describe('when the http call fails', () => {
      test('should throw an error', async () => {
        const services = factories.forestAdminHttpDriverServices.build();
        const dataSource = factories.dataSource.build();
        const options = factories.forestAdminHttpDriverOptions.build();

        services.forestHTTPApi.getIpWhitelist = jest.fn().mockRejectedValue(new Error());

        const ipWhitelistService = new IpWhitelist(services, dataSource, options);

        await expect(ipWhitelistService.bootstrap()).rejects.toThrowError();
      });
    });
  });

  describe('checkIp', () => {
    test('should call the next callback', async () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const dataSource = factories.dataSource.build();
      const options = factories.forestAdminHttpDriverOptions.build();

      const ipWhitelistService = new IpWhitelist(services, dataSource, options);

      const context = {} as unknown as Context;
      const next = jest.fn() as Next;
      await ipWhitelistService.checkIp(context, next);

      expect(next).toHaveBeenCalled();
    });

    describe('when the feature is enabled', () => {
      const setupServiceWith = (ipWhitelistService, values) => {
        const { isFeatureEnabled, ipRules } = values;
        ipWhitelistService.services.forestHTTPApi.getIpWhitelist = jest.fn().mockResolvedValue({
          isFeatureEnabled,
          ipRules,
        });

        return ipWhitelistService.bootstrap();
      };

      describe('when x-forwarded-for is missing', () => {
        test('should take the ip from the request', async () => {
          const services = factories.forestAdminHttpDriverServices.build();
          const dataSource = factories.dataSource.build();
          const options = factories.forestAdminHttpDriverOptions.build();

          const ipWhitelistService = new IpWhitelist(services, dataSource, options);

          const isFeatureEnabled = true;
          const ipRules = [
            {
              type: 0,
              ip: '10.20.15.10',
            },
          ];
          await setupServiceWith(ipWhitelistService, { isFeatureEnabled, ipRules });

          const context = {
            request: { ip: '10.20.15.10', headers: { 'x-forwarded-for': null } },
          } as unknown as Context;
          const next = jest.fn() as Next;

          await ipWhitelistService.checkIp(context, next);

          expect(next).toHaveBeenCalled();
        });
      });

      describe('when the ip is not allowed', () => {
        test('should throw error when the ip is not allowed and not call next', async () => {
          const services = factories.forestAdminHttpDriverServices.build();
          const dataSource = factories.dataSource.build();
          const options = factories.forestAdminHttpDriverOptions.build();

          const ipWhitelistService = new IpWhitelist(services, dataSource, options);

          const isFeatureEnabled = true;
          const ipRules = [
            {
              type: 0,
              ip: '10.20.15.10',
            },
          ];
          await setupServiceWith(ipWhitelistService, { isFeatureEnabled, ipRules });

          const notAllowedIp = '10.20.15.1';

          const context = {
            throw: jest.fn(),
            request: { headers: { 'x-forwarded-for': notAllowedIp } },
          } as unknown as Context;
          const next = jest.fn() as Next;

          await ipWhitelistService.checkIp(context, next);

          expect(next).not.toHaveBeenCalled();
          expect(context.throw).toHaveBeenCalledWith(
            HttpCode.Forbidden,
            `IP address rejected (${notAllowedIp})`,
          );
        });
      });

      describe('when the ip is allowed', () => {
        test('should call next', async () => {
          const services = factories.forestAdminHttpDriverServices.build();
          const dataSource = factories.dataSource.build();
          const options = factories.forestAdminHttpDriverOptions.build();

          const ipWhitelistService = new IpWhitelist(services, dataSource, options);

          const isFeatureEnabled = true;
          const ipRules = [
            {
              type: 0,
              ip: '10.20.15.10',
            },
          ];
          await setupServiceWith(ipWhitelistService, { isFeatureEnabled, ipRules });

          const allowedIp = '10.20.15.10';
          const context = {
            request: { headers: { 'x-forwarded-for': allowedIp } },
          } as unknown as Context;
          const next = jest.fn() as Next;
          await ipWhitelistService.checkIp(context, next);

          expect(next).toHaveBeenCalled();
        });
      });
    });
  });
});
