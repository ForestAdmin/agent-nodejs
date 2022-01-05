import BaseRoute from '../../src/routes/base-route';
import factories from '../__factories__';
import RouterMock, {
  routerMockDelete,
  routerMockGet,
  routerMockPost,
  routerMockPut,
  routerMockUse,
} from '../__mocks__/koa-router';
import servicesMock from '../__mocks__/services';

describe('Base routes', () => {
  const services = servicesMock;
  const dataSource = factories.dataSource.build();
  const options = { prefix: '/forest' };
  const router = new RouterMock();

  test('should not register any route', async () => {
    const baseRoute = new (class extends BaseRoute {})(services, dataSource, options);
    await baseRoute.bootstrap();
    baseRoute.setupPublicRoutes(router);
    baseRoute.setupAuthentication(router);
    baseRoute.setupPrivateRoutes(router);

    expect(routerMockGet).not.toHaveBeenCalled();
    expect(routerMockPost).not.toHaveBeenCalled();
    expect(routerMockPut).not.toHaveBeenCalled();
    expect(routerMockDelete).not.toHaveBeenCalled();
    expect(routerMockUse).not.toHaveBeenCalled();
  });
});
