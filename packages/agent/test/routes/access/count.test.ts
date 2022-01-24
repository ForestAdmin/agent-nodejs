import { AggregationOperation, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import Count from '../../../src/routes/access/count';
import * as factories from '../../__factories__';

describe('CountRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const partialCollection = {
    name: 'books',
    aggregate: jest.fn(),
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.build({
          columnType: PrimitiveTypes.Uuid,
          isPrimaryKey: true,
        }),
      },
    }),
  };
  const dataSource = factories.dataSource.buildWithCollection(partialCollection);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.get as jest.Mock).mockClear();
  });

  test('should register "/books/count" private routes', () => {
    const list = new Count(services, dataSource, options, partialCollection.name);
    list.setupPrivateRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books/count', expect.any(Function));
  });

  describe('handleCount', () => {
    test('should the aggregate implementation', async () => {
      const aggregateSpy = jest.fn().mockReturnValue([{ value: 2 }]);
      dataSource.getCollection('books').aggregate = aggregateSpy;
      const count = new Count(services, dataSource, options, partialCollection.name);
      const context = createMockContext({
        customProperties: { query: { timezone: 'Europe/Paris' } },
      });

      await count.handleCount(context);
      expect(aggregateSpy).toHaveBeenCalledWith(
        {
          search: undefined,
          searchExtended: false,
          segment: null,
          timezone: 'Europe/Paris',
        },
        { operation: AggregationOperation.Count },
      );
      expect(context.response.body).toEqual({ count: 2 });
    });

    describe('when an error happens', () => {
      test('should return an HTTP 400 response', async () => {
        dataSource.getCollection('books').aggregate = jest.fn().mockImplementation(() => {
          throw new Error();
        });

        const count = new Count(services, dataSource, options, partialCollection.name);
        const context = createMockContext();

        await count.handleCount(context);
        expect(context.throw).toHaveBeenCalledWith(500, 'Failed to count collection "books"');
      });
    });
  });
});
