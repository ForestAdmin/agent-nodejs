import { AggregationOperation } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import Count from '../../../../src/agent/routes/access/count';

describe('CountRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const collection = factories.collection.build({
    name: 'books',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
      },
    }),
  });
  const dataSource = factories.dataSource.buildWithCollection(collection);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  test('should register "/books/count" route', () => {
    const list = new Count(services, options, dataSource, collection.name);
    list.setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books/count', expect.any(Function));
  });

  describe('handleCount', () => {
    test('should aggregate the data and return the result', async () => {
      const aggregateSpy = jest.fn().mockReturnValue([{ value: 2 }]);
      dataSource.getCollection('books').aggregate = aggregateSpy;
      const count = new Count(services, options, dataSource, collection.name);
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
      });

      await count.handleCount(context);

      expect(aggregateSpy).toHaveBeenCalledWith(
        {
          conditionTree: null,
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
        { operation: AggregationOperation.Count },
      );
      expect(context.response.body).toEqual({ count: 2 });
    });
  });
});
