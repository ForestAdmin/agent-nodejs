import BaseRoute from '../../src/routes/base-route';
import factories from '../__factories__';

describe('Base routes', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.build();
  const options = factories.forestAdminHttpDriverOptions.build({
    prefix: '/forest',
  });
  const router = factories.router.mockAllMethods().build();

  test('should not register any route', async () => {
    const baseRoute = new (class extends BaseRoute {})(services, dataSource, options);
    await baseRoute.bootstrap();
    baseRoute.setupPublicRoutes(router);
    baseRoute.setupAuthentication(router);
    baseRoute.setupPrivateRoutes(router);

    expect(router.get).not.toHaveBeenCalled();
    expect(router.post).not.toHaveBeenCalled();
    expect(router.put).not.toHaveBeenCalled();
    expect(router.delete).not.toHaveBeenCalled();
    expect(router.use).not.toHaveBeenCalled();
  });
});
