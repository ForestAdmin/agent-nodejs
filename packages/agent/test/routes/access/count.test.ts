import { AggregationOperation } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import Count from '../../../src/routes/access/count';
import * as factories from '../../__factories__';
import { HttpCode } from '../../../dist/types';

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

  test('should register "/books/count" private routes', () => {
    const list = new Count(services, dataSource, options, collection.name);
    list.setupPrivateRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books/count', expect.any(Function));
  });

  describe('handleCount', () => {
    test('should the aggregate implementation', async () => {
      const aggregateSpy = jest.fn().mockReturnValue([{ value: 2 }]);
      dataSource.getCollection('books').aggregate = aggregateSpy;
      const count = new Count(services, dataSource, options, collection.name);
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
      });

      await count.handleCount(context);

      expect(context.throw).not.toHaveBeenCalled();
      expect(aggregateSpy).toHaveBeenCalledWith(
        {
          search: null,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
        { operation: AggregationOperation.Count },
      );
      expect(context.response.body).toEqual({ count: 2 });
    });

    describe('when an error happens', () => {
      test('should return an HTTP 500 response', async () => {
        dataSource.getCollection('books').aggregate = jest.fn().mockImplementation(() => {
          throw new Error();
        });

        const count = new Count(services, dataSource, options, collection.name);
        const context = createMockContext();

        await count.handleCount(context);
        expect(context.throw).toHaveBeenCalledWith(
          HttpCode.InternalServerError,
          'Failed to count collection "books"',
        );
      });
    });
  });
});
