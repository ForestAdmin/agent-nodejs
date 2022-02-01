import { AggregationOperation, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import CountRelatedRoute from '../../../dist/routes/access/count-related';
import * as factories from '../../__factories__';
import { HttpCode } from '../../../dist/types';

describe('CountRelatedRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  const persons = factories.collection.build({
    name: 'persons',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.build({ isPrimaryKey: true }),
        myBookPerson: factories.oneToOneSchema.build({
          foreignCollection: 'bookPersons',
          foreignKey: 'personId',
        }),
      },
    }),
  });

  const bookPersons = factories.collection.build({
    name: 'bookPersons',
    schema: factories.collectionSchema.build({
      fields: {
        bookId: factories.columnSchema.build({ isPrimaryKey: true }),
        personId: factories.columnSchema.build({ isPrimaryKey: true }),
        myBook: factories.manyToOneSchema.build({
          foreignCollection: 'books',
          foreignKey: 'bookId',
        }),
        myPerson: factories.manyToOneSchema.build({
          foreignCollection: 'persons',
          foreignKey: 'personId',
        }),
        date: factories.columnSchema.build({ columnType: PrimitiveTypes.Date }),
      },
    }),
  });

  const books = factories.collection.build({
    name: 'books',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.build({ isPrimaryKey: true }),
        myPersons: factories.manyToManySchema.build({
          foreignCollection: 'persons',
          foreignKey: 'personId',
          otherField: 'bookId',
          throughCollection: 'bookPersons',
        }),
        myBookPersons: factories.oneToManySchema.build({
          foreignCollection: 'bookPersons',
          foreignKey: 'bookId',
        }),
      },
    }),
  });

  const dataSource = factories.dataSource.buildWithCollections([persons, bookPersons, books]);

  test('should register "/books/count" private routes', () => {
    const count = new CountRelatedRoute(services, dataSource, options, books.name, 'myBookPersons');
    count.setupPrivateRoutes(router);

    expect(router.get).toHaveBeenCalledWith(
      '/books/:parentId/relationships/myBookPersons/count',
      expect.any(Function),
    );
  });

  describe('handleCount', () => {
    test('should the aggregate implementation', async () => {
      const aggregateSpy = jest.fn().mockReturnValue([{ value: 2 }]);
      dataSource.getCollection('books').aggregate = aggregateSpy;
      const count = new CountRelatedRoute(
        services,
        dataSource,
        options,
        books.name,
        'myBookPersons',
      );
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
          page: {
            limit: 15,
            skip: 0,
          },
          sort: [
            {
              ascending: true,
              field: 'id',
            },
          ],
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

        const count = new CountRelatedRoute(services, dataSource, options, partialCollection.name);
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
