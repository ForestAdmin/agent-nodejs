import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import HealthCheck from '../../../../src/agent/routes/system/healthcheck';

describe('Healthcheck', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.get as jest.Mock).mockClear();
  });

  test("should register '/' public routes", () => {
    const healthCheck = new HealthCheck(services, options);
    healthCheck.setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/', expect.any(Function));
  });

  test('return a 200 response', async () => {
    const healthCheck = new HealthCheck(services, options);
    const context = createMockContext();
    await healthCheck.handleRequest(context);

    expect(context.response.status).toEqual(200);
  });
});
