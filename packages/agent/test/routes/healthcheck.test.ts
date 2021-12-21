import { Context } from 'koa';
import HealthCheck from '../../src/routes/healthcheck';
import DataSourceMock from '../__mocks__/datasource';
import RouterMock, { routerMockGet } from '../__mocks__/koa-router';

describe('Healthcheck', () => {
  const services = {};
  const dataSource = new DataSourceMock();
  const options = { prefix: '/forest' };
  const router = new RouterMock();

  beforeEach(() => {
    routerMockGet.mockClear();
  });

  test("should register '/' and '/healthcheck' public routes", () => {
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
