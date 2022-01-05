import { Context } from 'koa';
import HealthCheck from '../../src/routes/healthcheck';
import factories from '../__factories__';
import RouterMock, { routerMockGet } from '../__mocks__/koa-router';
import servicesMock from '../__mocks__/services';

describe('Healthcheck', () => {
  const services = servicesMock;
  const dataSource = factories.dataSource.build();
  const options = { prefix: '/forest' };
  const router = new RouterMock();

  beforeEach(() => {
    routerMockGet.mockClear();
  });

  test("should register '/' public routes", () => {
    const healthCheck = new HealthCheck(services, dataSource, options);
    healthCheck.setupPublicRoutes(router);

    expect(routerMockGet).toHaveBeenCalledWith('/', expect.any(Function));
  });

  test('return a 200 response', async () => {
    const healthCheck = new HealthCheck(services, dataSource, options);
    const context = { response: {} } as Context;
    await healthCheck.handleRequest(context);

    expect(context.response.status).toEqual(200);
  });
});
