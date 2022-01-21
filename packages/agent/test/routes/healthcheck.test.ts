import { createMockContext } from '@shopify/jest-koa-mocks';
import HealthCheck from '../../src/routes/healthcheck';
import * as factories from '../__factories__';

describe('Healthcheck', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.get as jest.Mock).mockClear();
  });

  test("should register '/' public routes", () => {
    const healthCheck = new HealthCheck(services, dataSource, options);
    healthCheck.setupPublicRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/', expect.any(Function));
  });

  test('return a 200 response', async () => {
    const healthCheck = new HealthCheck(services, dataSource, options);
    const context = createMockContext();
    await healthCheck.handleRequest(context);

    expect(context.response.status).toEqual(200);
  });
});
