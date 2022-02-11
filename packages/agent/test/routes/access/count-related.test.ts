import {
  Aggregation,
  AggregationOperation,
  CollectionUtils,
  ConditionTreeLeaf,
  Operator,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';
import CountRelatedRoute from '../../../src/routes/access/count-related';

describe('CountRelatedRoute', () => {
  const setupWithOneToManyRelation = () => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const bookPersons = factories.collection.build({
      name: 'bookPersons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
        },
      }),
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
    const { services, dataSource, options, router } = setupWithOneToManyRelation();

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
        const { services, dataSource, options } = setupWithOneToManyRelation();
        dataSource.getCollection('bookPersons').schema.segments = ['a-valid-segment'];

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

        const searchParams = { search: 'searched argument' };
        const filtersParams = {
          filters: JSON.stringify({
            aggregator: 'and',
            conditions: [
              { field: 'id', operator: 'equal', value: '123e4567-e89b-12d3-a456-426614174000' },
            ],
          }),
        };
        const segmentParams = { segment: 'a-valid-segment' };
        const customProperties = {
          query: {
            ...searchParams,
            ...filtersParams,
            ...segmentParams,
            timezone: 'Europe/Paris',
          },
          params: { parentId: '1523' },
        };
        const context = createMockContext({ customProperties });
        await count.handleCountRelated(context);

        expect(CollectionUtils.aggregateRelation).toHaveBeenCalledWith(
          dataSource.getCollection('books'),
          ['1523'],
          'myBookPersons',
          new PaginatedFilter({
            search: 'searched argument',
            searchExtended: false,
            timezone: 'Europe/Paris',
            segment: 'a-valid-segment',
            conditionTree: new ConditionTreeLeaf(
              'id',
              Operator.Equal,
              '123e4567-e89b-12d3-a456-426614174000',
            ),
          }),
          new Aggregation({ operation: AggregationOperation.Count }),
        );

        expect(context.throw).not.toHaveBeenCalled();
        expect(context.response.body).toEqual({ count: 1568 });
      });

      describe('when there is empty aggregate result', () => {
        test('should return 0 ', async () => {
          const { services, dataSource, options } = setupWithOneToManyRelation();

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
        const { services, dataSource, options } = setupWithOneToManyRelation();

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
        const { services, dataSource, options } = setupWithOneToManyRelation();

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
