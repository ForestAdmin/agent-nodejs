import { createMockContext } from '@shopify/jest-koa-mocks';

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
        id: factories.columnSchema.numericPrimaryKey().build(),
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

    beforeEach(() => {
      route = new CollectionApiChartRoute(services, options, dataSource, 'books', 'myChart');
    });

    test('handleApiChart should return the chart in a JSON-API response', async () => {
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
        state: { user: { email: 'marty@doclabs.com' } },
        requestBody: { record_id: 123 },
      });

      // @ts-expect-error: testing private method
      await route.handleApiChart(context);

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

      // @ts-expect-error: testing private method
      await route.handleSmartChart(context);

      expect(dataSource.getCollection('books').renderChart).toHaveBeenCalledWith(
        { email: 'marty@doclabs.com', timezone: 'Europe/Paris' },
        'myChart',
        [123],
      );
      expect(context.response.body).toStrictEqual({ countCurrent: 12 });
    });
  });
});
