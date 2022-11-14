import { createMockContext } from '@shopify/jest-koa-mocks';
import { Context, Next } from 'koa';

import IpWhitelist from '../../../src/routes/security/ip-whitelist';
import { HttpCode } from '../../../src/types';
import * as factories from '../../__factories__';

jest.mock('../../../src/utils/forest-http-api', () => ({
  getIpWhitelistConfiguration: jest.fn(),
}));

describe('IpWhitelist', () => {
  describe('setupRoutes', () => {
    test('should attach the checkIp method to the router', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const options = factories.forestAdminHttpDriverOptions.build();
      const ipWhitelistService = new IpWhitelist(services, options);

      const router = factories.router.build();
      router.use = jest.fn();

      ipWhitelistService.setupRoutes(router);

      expect((router.use as jest.Mock).mock.calls[0][0].name).toEqual('bound checkIp');
    });
  });

  describe('bootstrap', () => {
    describe('when the http call succeeds', () => {
      test('should not throw an error', async () => {
        const services = factories.forestAdminHttpDriverServices.build();
        const options = factories.forestAdminHttpDriverOptions.build({
          forestAdminClient: factories.forestAdminClient.build({
            getIpWhitelistConfiguration: jest.fn().mockResolvedValue({
              isFeatureEnabled: true,
              ipRules: [],
            }),
          }),
        });

        const ipWhitelistService = new IpWhitelist(services, options);
        await expect(ipWhitelistService.bootstrap()).resolves.not.toThrowError();
      });
    });

    describe('when the http call fails', () => {
      test('should throw an error', async () => {
        const services = factories.forestAdminHttpDriverServices.build();
        const options = factories.forestAdminHttpDriverOptions.build({
          forestAdminClient: factories.forestAdminClient.build({
            getIpWhitelistConfiguration: jest.fn().mockRejectedValue(new Error()),
          }),
        });

        const ipWhitelistService = new IpWhitelist(services, options);

        await expect(ipWhitelistService.bootstrap()).rejects.toThrowError();
      });
    });
  });

  describe('checkIp', () => {
    const setupIpWhitelistService = async (values: {
      isFeatureEnabled: boolean;
      ipRules: unknown[];
    }) => {
      const services = factories.forestAdminHttpDriverServices.build();
      const options = factories.forestAdminHttpDriverOptions.build({
        forestAdminClient: factories.forestAdminClient.build({
          getIpWhitelistConfiguration: jest.fn().mockResolvedValue(values),
        }),
      });

      const ipWhitelistService = new IpWhitelist(services, options);
      await ipWhitelistService.bootstrap();

      return ipWhitelistService;
    };

    test('should call the next callback', async () => {
      const ipWhitelistService = await setupIpWhitelistService({
        isFeatureEnabled: false,
        ipRules: [],
      });

      const context = createMockContext();
      const next = jest.fn() as Next;
      await ipWhitelistService.checkIp(context, next);

      expect(next).toHaveBeenCalled();
    });

    describe('when the feature is enabled', () => {
      describe('when x-forwarded-for is missing', () => {
        test.each([
          { type: 0, ip: '10.20.15.10' },
          { type: 1, ipMinimum: '10.20.15.10', ipMaximum: '10.20.15.11' },
          { type: 2, range: '10.20.15.0/24' },
        ])('should let pass a valid query', async rule => {
          const ipWhitelistService = await setupIpWhitelistService({
            isFeatureEnabled: true,
            ipRules: [rule],
          });

          // The ip property of the koa context is not supposed to be changed
          // Thus, forging a manual context is the only way of testing this function
          const context = {
            request: { ip: '10.20.15.10', headers: { 'x-forwarded-for': null } },
          } as unknown as Context;
          const next = jest.fn() as Next;

          await ipWhitelistService.checkIp(context, next);

          expect(next).toHaveBeenCalled();
        });
      });

      describe('when the ip is not allowed', () => {
        test.each([
          { type: 0, ip: '10.10.15.1' },
          { type: 1, ipMinimum: '10.10.15.1', ipMaximum: '10.10.15.2' },
          { type: 2, range: '10.10.15.0/24' },
        ])('should throw when the ip is not allowed', async rule => {
          const ipWhitelistService = await setupIpWhitelistService({
            isFeatureEnabled: true,
            ipRules: [rule],
          });

          const notAllowedIp = '10.20.15.1';

          const context = createMockContext({ headers: { 'x-forwarded-for': notAllowedIp } });
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
          const ipWhitelistService = await setupIpWhitelistService({
            isFeatureEnabled: true,
            ipRules: [{ type: 0, ip: '10.20.15.10' }],
          });

          const allowedIp = '10.20.15.10';
          const context = createMockContext({ headers: { 'x-forwarded-for': allowedIp } });
          const next = jest.fn() as Next;
          await ipWhitelistService.checkIp(context, next);

          expect(next).toHaveBeenCalled();
        });
      });
    });
  });
});
