import { createMockContext } from '@shopify/jest-koa-mocks';
import Router from '@koa/router';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';
import ScopeInvalidation from '../../../src/routes/security/scope-invalidation';

describe('ScopeInvalidation', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();
  const services = factories.forestAdminHttpDriverServices.build();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('should register "/scope-cache-invalidation" private routes', () => {
    const route = new ScopeInvalidation(services, options);
    route.setupPrivateRoutes(router);

    expect(router.post).toHaveBeenCalledWith('/scope-cache-invalidation', expect.any(Function));
  });

  describe('with the route mounted', () => {
    let route: ScopeInvalidation;
    let invalidateCache: Router.Middleware;

    beforeEach(() => {
      route = new ScopeInvalidation(services, options);
      route.setupPrivateRoutes({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        post: (_: string, handler: Router.Middleware) => {
          invalidateCache = handler;
        },
      });
    });

    test('should throw if body is not provided', async () => {
      const context = createMockContext({});

      await invalidateCache.call(route, context);
      expect(context.throw).toHaveBeenCalledWith(HttpCode.BadRequest, 'Malformed body');
    });

    test('should throw if rendering id is invalid', async () => {
      const context = createMockContext({ requestBody: { renderingId: 'not_a_number' } });

      await invalidateCache.call(route, context);
      expect(context.throw).toHaveBeenCalledWith(HttpCode.BadRequest, 'Malformed body');
    });

    test('should invalidate cache otherwise', async () => {
      const context = createMockContext({ requestBody: { renderingId: 1 } });

      await invalidateCache.call(route, context);
      expect(context.throw).not.toHaveBeenCalled();
      expect(services.scope.invalidateCache).toHaveBeenCalledWith(1);
    });
  });
});
