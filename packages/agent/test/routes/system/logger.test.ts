import Router from '@koa/router';

import Logger from '../../../src/routes/system/logger';
import * as factories from '../../__factories__';

describe('Logger', () => {
  const router = factories.router.mockAllMethods().build();
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build({
    logger: jest.fn(),
  });

  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date());
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('should register a middleware', () => {
    const route = new Logger(services, options);
    route.setupRoutes(router);

    expect(router.use).toHaveBeenCalledWith(expect.any(Function));
  });

  describe('with the route mounted', () => {
    let route: Logger;
    let handleLog: Router.Middleware;

    beforeEach(() => {
      route = new Logger(services, options);
      route.setupRoutes({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        use: (handler: Router.Middleware) => {
          handleLog = handler;
        },
      });
    });

    test('should log the request when everything goes well', async () => {
      const context = {
        request: { method: 'GET', path: 'someUrl' },
        response: { status: 200 },
      };
      const next = jest.fn().mockResolvedValue(undefined);

      await handleLog.call(route, context, next);

      expect(options.logger).toHaveBeenCalledWith('Info', '[200] GET someUrl - 0ms');
    });

    test('should log the request when the route respond with 400', async () => {
      const context = {
        request: { method: 'GET', path: 'someUrl' },
        response: { status: 400 },
      };
      const next = jest.fn().mockResolvedValue(undefined);

      await handleLog.call(route, context, next);
      expect(options.logger).toHaveBeenCalledWith('Warn', '[400] GET someUrl - 0ms');
    });

    test('should log the request when the route throws', async () => {
      const context = {
        request: { method: 'GET', path: 'someUrl' },
        response: { status: 500 },
      };
      const next = jest.fn().mockRejectedValue(new Error('RouteError'));

      await expect(handleLog.call(route, context, next)).rejects.toThrow('RouteError');
      expect(options.logger).toHaveBeenCalledWith('Error', '[500] GET someUrl - 0ms');
    });
  });
});
