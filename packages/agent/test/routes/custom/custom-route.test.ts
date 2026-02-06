import type {
  CustomRouterCallback,
  CustomRouterContext,
  CustomRouterOptions,
} from '../../../src/types';

import Router from '@koa/router';

import CustomRoute from '../../../src/routes/custom/custom-route';
import { RouteType } from '../../../src/types';
import * as factories from '../../__factories__';

describe('CustomRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const dataSource = factories.dataSource.build();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('type', () => {
    test('should return RouteType.CustomRoute when authenticated is true (default)', () => {
      const callback: CustomRouterCallback = jest.fn();
      const customRoute = new CustomRoute(services, options, dataSource, callback);

      expect(customRoute.type).toBe(RouteType.CustomRoute);
    });

    test('should return RouteType.CustomRoute when authenticated is explicitly true', () => {
      const callback: CustomRouterCallback = jest.fn();
      const customRoute = new CustomRoute(services, options, dataSource, callback, {
        authenticated: true,
      });

      expect(customRoute.type).toBe(RouteType.CustomRoute);
    });

    test('should return RouteType.PublicCustomRoute when authenticated is false', () => {
      const callback: CustomRouterCallback = jest.fn();
      const customRoute = new CustomRoute(services, options, dataSource, callback, {
        authenticated: false,
      });

      expect(customRoute.type).toBe(RouteType.PublicCustomRoute);
    });
  });

  describe('setupRoutes', () => {
    test('should call the callback with a router and context', () => {
      const callback = jest.fn();
      const customRoute = new CustomRoute(services, options, dataSource, callback);
      const mainRouter = new Router();
      jest.spyOn(mainRouter, 'use');

      customRoute.setupRoutes(mainRouter);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.any(Router), expect.any(Object));
    });

    test('should provide context with dataSource', () => {
      let receivedContext: CustomRouterContext | undefined;

      const callback: CustomRouterCallback = (_, context) => {
        receivedContext = context;
      };

      const customRoute = new CustomRoute(services, options, dataSource, callback);
      const mainRouter = new Router();

      customRoute.setupRoutes(mainRouter);

      expect(receivedContext?.dataSource).toBe(dataSource);
    });

    test('should provide context with services', () => {
      let receivedContext: CustomRouterContext | undefined;

      const callback: CustomRouterCallback = (_, context) => {
        receivedContext = context;
      };

      const customRoute = new CustomRoute(services, options, dataSource, callback);
      const mainRouter = new Router();

      customRoute.setupRoutes(mainRouter);

      expect(receivedContext?.services).toBe(services);
    });

    test('should provide context with options', () => {
      let receivedContext: CustomRouterContext | undefined;

      const callback: CustomRouterCallback = (_, context) => {
        receivedContext = context;
      };

      const customRoute = new CustomRoute(services, options, dataSource, callback);
      const mainRouter = new Router();

      customRoute.setupRoutes(mainRouter);

      expect(receivedContext?.options).toBe(options);
    });

    test('should provide context with logger from options', () => {
      let receivedContext: CustomRouterContext | undefined;

      const callback: CustomRouterCallback = (_, context) => {
        receivedContext = context;
      };

      const customRoute = new CustomRoute(services, options, dataSource, callback);
      const mainRouter = new Router();

      customRoute.setupRoutes(mainRouter);

      expect(receivedContext?.logger).toBe(options.logger);
    });

    test('should mount the custom router on the main router', () => {
      const callback: CustomRouterCallback = router => {
        router.get('/test', ctx => {
          ctx.body = 'ok';
        });
      };

      const customRoute = new CustomRoute(services, options, dataSource, callback);
      const mainRouter = new Router();
      jest.spyOn(mainRouter, 'use');

      customRoute.setupRoutes(mainRouter);

      expect(mainRouter.use).toHaveBeenCalled();
    });

    test('should apply prefix to the custom router when specified', () => {
      let receivedRouter: Router | undefined;

      const callback: CustomRouterCallback = router => {
        receivedRouter = router;
      };

      const customOptions: CustomRouterOptions = { prefix: '/custom' };
      const customRoute = new CustomRoute(services, options, dataSource, callback, customOptions);
      const mainRouter = new Router();

      customRoute.setupRoutes(mainRouter);

      expect(receivedRouter?.opts?.prefix).toBe('/custom');
    });

    test('should not apply prefix when not specified', () => {
      let receivedRouter: Router | undefined;

      const callback: CustomRouterCallback = router => {
        receivedRouter = router;
      };

      const customRoute = new CustomRoute(services, options, dataSource, callback);
      const mainRouter = new Router();

      customRoute.setupRoutes(mainRouter);

      expect(receivedRouter?.opts?.prefix).toBeUndefined();
    });

    test('should not apply prefix when empty string', () => {
      let receivedRouter: Router | undefined;

      const callback: CustomRouterCallback = router => {
        receivedRouter = router;
      };

      const customOptions: CustomRouterOptions = { prefix: '' };
      const customRoute = new CustomRoute(services, options, dataSource, callback, customOptions);
      const mainRouter = new Router();

      customRoute.setupRoutes(mainRouter);

      expect(receivedRouter?.opts?.prefix).toBeUndefined();
    });
  });
});
