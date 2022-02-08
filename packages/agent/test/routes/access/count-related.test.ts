import {
  Aggregation,
  AggregationOperation,
  CollectionUtils,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import CountRelatedRoute from '../../../src/routes/access/count-related';
import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';
import QueryStringParser from '../../../src/utils/query-string';

describe('CountRelatedRoute', () => {
  const setup = () => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const bookPersons = factories.collection.build({
      name: 'bookPersons',
    });

    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          myBookPersons: factories.oneToManySchema.build({
            foreignCollection: 'bookPersons',
          }),
        },
      }),
    });
    const dataSource = factories.dataSource.buildWithCollections([bookPersons, books]);

    return {
      dataSource,
      services,
      options,
      router,
    };
  };

  const setupContext = () => {
    const customProperties = {
      query: { timezone: 'Europe/Paris' },
      params: { parentId: '1523' },
    };

    return createMockContext({ customProperties });
  };

  test('should register "/books/count" private routes', () => {
    const { services, dataSource, options, router } = setup();

    const oneToManyRelationName = 'myBookPersons';
    const count = new CountRelatedRoute(
      services,
      options,
      dataSource,
      dataSource.getCollection('books').name,
      oneToManyRelationName,
    );
    count.setupPrivateRoutes(router);

    expect(router.get).toHaveBeenCalledWith(
      '/books/:parentId/relationships/myBookPersons/count',
      expect.any(Function),
    );
  });

  describe('handleCountRelated', () => {
    describe('when the request is correct', () => {
      test('should aggregate the relation and return the result', async () => {
        const { services, dataSource, options } = setup();

        const oneToManyRelationName = 'myBookPersons';
        const count = new CountRelatedRoute(
          services,
          options,
          dataSource,
          dataSource.getCollection('books').name,
          oneToManyRelationName,
        );

        jest
          .spyOn(CollectionUtils, 'aggregateRelation')
          .mockResolvedValue([{ value: 1568, group: {} }]);

        const context = setupContext();
        await count.handleCountRelated(context);

        expect(CollectionUtils.aggregateRelation).toHaveBeenCalledWith(
          dataSource.getCollection('books'),
          ['1523'],
          'myBookPersons',
          new PaginatedFilter({
            search: QueryStringParser.parseSearch(context),
            searchExtended: QueryStringParser.parseSearchExtended(context),
            timezone: QueryStringParser.parseTimezone(context),
            segment: QueryStringParser.parseSegment(dataSource.getCollection('persons'), context),
            conditionTree: QueryStringParser.parseConditionTree(
              dataSource.getCollection('persons'),
              context,
            ),
          }),
          new Aggregation({ operation: AggregationOperation.Count }),
        );
        expect(context.throw).not.toHaveBeenCalled();
        expect(context.response.body).toEqual({ count: 1568 });
      });

      describe('when there is empty aggregate result', () => {
        test('should return 0 ', async () => {
          const { services, dataSource, options } = setup();

          const oneToManyRelationName = 'myBookPersons';
          const count = new CountRelatedRoute(
            services,
            options,
            dataSource,
            dataSource.getCollection('books').name,
            oneToManyRelationName,
          );

          jest.spyOn(CollectionUtils, 'aggregateRelation').mockResolvedValue(null);

          const context = setupContext();
          await count.handleCountRelated(context);

          await count.handleCountRelated(context);

          expect(context.throw).not.toHaveBeenCalled();
          expect(context.response.body).toEqual({ count: 0 });
        });
      });
    });

    describe('when an error happens', () => {
      test('should return an HTTP 400 response when the request is malformed', async () => {
        const { services, dataSource, options } = setup();

        const oneToManyRelationName = 'myBookPersons';
        const count = new CountRelatedRoute(
          services,
          options,
          dataSource,
          dataSource.getCollection('books').name,
          oneToManyRelationName,
        );

        const customProperties = {
          query: { timezone: 'Europe/Paris' },
          params: { BAD_ATTRIBUTE: '1523' },
        };
        const context = createMockContext({ customProperties });
        await count.handleCountRelated(context);

        expect(context.throw).toHaveBeenCalledWith(HttpCode.BadRequest, expect.any(String));
      });

      test('should return an HTTP 500 response when the aggregate has a problem', async () => {
        const { services, dataSource, options } = setup();

        const oneToManyRelationName = 'myBookPersons';
        const count = new CountRelatedRoute(
          services,
          options,
          dataSource,
          dataSource.getCollection('books').name,
          oneToManyRelationName,
        );

        jest.spyOn(CollectionUtils, 'aggregateRelation').mockImplementation(() => {
          throw new Error('an error');
        });

        const context = setupContext();
        await count.handleCountRelated(context);

        expect(context.throw).toHaveBeenCalledWith(
          HttpCode.InternalServerError,
          'Failed to count the collection relation of the "books"',
        );
      });
    });
  });
});
