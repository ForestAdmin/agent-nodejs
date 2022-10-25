import { createMockContext } from '@shopify/jest-koa-mocks';
import Router from '@koa/router';

import * as factories from '../../__factories__';
import CollectionApiChartRoute from '../../../src/routes/access/api-chart-collection';

describe('CollectionApiChartRoute', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.buildWithCollection({
    name: 'books',
    schema: factories.collectionSchema.build({
      charts: ['myChart'],
      fields: {
        id: factories.columnSchema.build({ columnType: 'Number', isPrimaryKey: true }),
      },
    }),
    renderChart: jest.fn().mockResolvedValue({ countCurrent: 12 }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should register "/_charts/books/myChart" GET and POST route', () => {
    const route = new CollectionApiChartRoute(services, options, dataSource, 'books', 'myChart');
    route.setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/_charts/books/myChart', expect.any(Function));
    expect(router.post).toHaveBeenCalledWith('/_charts/books/myChart', expect.any(Function));
  });

  describe('with the route mounted', () => {
    let route: CollectionApiChartRoute;
    let handleApiChart: Router.Middleware;
    let handleSmartChart: Router.Middleware;

    beforeEach(() => {
      route = new CollectionApiChartRoute(services, options, dataSource, 'books', 'myChart');
      route.setupRoutes({
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        post: (_: string, handler: Router.Middleware) => {
          handleApiChart = handler;
        },
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        get: (_: string, handler: Router.Middleware) => {
          handleSmartChart = handler;
        },
      });
    });

    test('handleApiChart should return the chart in a JSON-API response', async () => {
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
        state: { user: { email: 'marty@doclabs.com' } },
        requestBody: { record_id: 123 },
      });
      await handleApiChart.call(route, context);

      expect(dataSource.getCollection('books').renderChart).toHaveBeenCalledWith(
        { email: 'marty@doclabs.com', timezone: 'Europe/Paris' },
        'myChart',
        [123],
      );
      expect(context.response.body).toMatchObject({
        data: {
          attributes: { value: { countCurrent: 12 } },
          id: expect.any(String),
          type: 'stats',
        },
      });
    });

    test('handleSmartChart should return the chart in the body', async () => {
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris', record_id: 123 } },
        state: { user: { email: 'marty@doclabs.com' } },
      });

      await handleSmartChart.call(route, context);

      expect(dataSource.getCollection('books').renderChart).toHaveBeenCalledWith(
        { email: 'marty@doclabs.com', timezone: 'Europe/Paris' },
        'myChart',
        [123],
      );
      expect(context.response.body).toStrictEqual({ countCurrent: 12 });
    });
  });
});
