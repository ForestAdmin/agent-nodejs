import Router from '@koa/router';

import * as factories from '../__factories__';
import { RouteType } from '../../src/types';
import BaseRoute from '../../src/routes/base-route';

describe('Base routes', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  test('should not register any route', async () => {
    const Route = class extends BaseRoute {
      type = RouteType.PublicRoute;
      setupRoutes(aRouter: Router): void {
        void aRouter;
      }
    };

    const baseRoute = new Route(services, options);
    await baseRoute.bootstrap();
    baseRoute.setupRoutes(router);

    expect(router.get).not.toHaveBeenCalled();
    expect(router.post).not.toHaveBeenCalled();
    expect(router.put).not.toHaveBeenCalled();
    expect(router.delete).not.toHaveBeenCalled();
    expect(router.use).not.toHaveBeenCalled();
  });
});
