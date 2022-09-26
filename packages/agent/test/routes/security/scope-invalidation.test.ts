import { createMockContext } from '@shopify/jest-koa-mocks';
import Router from '@koa/router';

import * as factories from '../../__factories__';
import ScopeInvalidation from '../../../src/routes/security/scope-invalidation';

describe('ScopeInvalidation', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();
  const services = factories.forestAdminHttpDriverServices.build();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('should register "/scope-cache-invalidation" route', () => {
    const route = new ScopeInvalidation(services, options);
    route.setupRoutes(router);

    expect(router.post).toHaveBeenCalledWith('/scope-cache-invalidation', expect.any(Function));
  });

  describe('with the route mounted', () => {
    let route: ScopeInvalidation;
    let invalidateCache: Router.Middleware;

    beforeEach(() => {
      route = new ScopeInvalidation(services, options);
      route.setupRoutes({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        post: (_: string, handler: Router.Middleware) => {
          invalidateCache = handler;
        },
      });
    });

    test('should throw if body is not provided', async () => {
      const context = createMockContext({});
      const result = invalidateCache.call(route, context);

      await expect(result).rejects.toThrow('Malformed body');
    });

    test('should throw if rendering id is invalid', async () => {
      const context = createMockContext({ requestBody: { renderingId: 'not_a_number' } });
      const result = invalidateCache.call(route, context);

      await expect(result).rejects.toThrow('Malformed body');
    });

    test('should invalidate cache otherwise', async () => {
      const context = createMockContext({ requestBody: { renderingId: 1 } });

      await invalidateCache.call(route, context);

      expect(services.permissions.invalidateCache).toHaveBeenCalledWith(1);
    });
  });
});
