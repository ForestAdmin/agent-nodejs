import {
  Aggregation,
  CollectionUtils,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  Filter,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import CountRelatedRoute from '../../../src/routes/access/count-related';
import * as factories from '../../__factories__';

describe('CountRelatedRoute', () => {
  const setupWithOneToManyRelation = (countable = true) => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const bookPersons = factories.collection.build({
      name: 'bookPersons',
      schema: factories.collectionSchema.build({
        countable,
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
        },
      }),
    });

    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.uuidPrimaryKey().build(),
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
      params: { parentId: '2d162303-78bf-599e-b197-93590ac3d315' },
    };

    return createMockContext({ customProperties });
  };

  test('should register "/books/count" route', () => {
    const { services, dataSource, options, router } = setupWithOneToManyRelation();

    const oneToManyRelationName = 'myBookPersons';
    const count = new CountRelatedRoute(
      services,
      options,
      dataSource,
      'books',
      oneToManyRelationName,
    );
    count.setupRoutes(router);

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
          'books',
          oneToManyRelationName,
        );

        jest
          .spyOn(CollectionUtils, 'aggregateRelation')
          .mockResolvedValue([{ value: 1568, group: {} }]);

        const searchParams = { search: 'searched argument' };
        const conditionTreeParams = {
          filters: JSON.stringify({
            aggregator: 'And',
            conditions: [
              { field: 'id', operator: 'Equal', value: '123e4567-e89b-12d3-a456-426614174000' },
            ],
          }),
        };
        const segmentParams = { segment: 'a-valid-segment' };

        const context = createMockContext({
          customProperties: {
            query: {
              ...searchParams,
              ...conditionTreeParams,
              ...segmentParams,
              timezone: 'Europe/Paris',
            },
            params: { parentId: '2d162303-78bf-599e-b197-93590ac3d315' },
          },
          state: { user: { email: 'john.doe@domain.com' } },
        });
        await count.handleCountRelated(context);

        expect(CollectionUtils.aggregateRelation).toHaveBeenCalledWith(
          dataSource.getCollection('books'),
          ['2d162303-78bf-599e-b197-93590ac3d315'],
          'myBookPersons',
          {
            email: 'john.doe@domain.com',
            requestId: expect.any(String),
            request: { ip: expect.any(String) },
            timezone: 'Europe/Paris',
          },
          new Filter({
            search: 'searched argument',
            searchExtended: false,
            segment: 'a-valid-segment',
            liveQuerySegment: expect.toBeNil(),
            conditionTree: new ConditionTreeLeaf(
              'id',
              'Equal',
              '123e4567-e89b-12d3-a456-426614174000',
            ),
          }),
          new Aggregation({ operation: 'Count' }),
        );

        expect(context.response.body).toEqual({ count: 1568 });
      });

      test("should check the user's permission", async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation();

        const oneToManyRelationName = 'myBookPersons';
        const count = new CountRelatedRoute(
          services,
          options,
          dataSource,
          'books',
          oneToManyRelationName,
        );

        jest
          .spyOn(CollectionUtils, 'aggregateRelation')
          .mockResolvedValue([{ value: 1568, group: {} }]);

        const context = setupContext();
        await count.handleCountRelated(context);
        expect(services.authorization.assertCanBrowse as jest.Mock).toHaveBeenCalledWith(
          context,
          'books',
        );

        expect(context.response.body).toEqual({ count: 1568 });
      });

      test('it should apply the scope', async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation();
        dataSource.getCollection('bookPersons').schema.segments = ['a-valid-segment'];

        const oneToManyRelationName = 'myBookPersons';
        const count = new CountRelatedRoute(
          services,
          options,
          dataSource,
          'books',
          oneToManyRelationName,
        );

        jest
          .spyOn(CollectionUtils, 'aggregateRelation')
          .mockResolvedValue([{ value: 1568, group: {} }]);

        const searchParams = { search: 'searched argument' };
        const conditionTreeParams = {
          filters: JSON.stringify({
            aggregator: 'And',
            conditions: [
              { field: 'id', operator: 'Equal', value: '123e4567-e89b-12d3-a456-426614174000' },
            ],
          }),
        };
        const segmentParams = { segment: 'a-valid-segment', liveQuerySegment: expect.toBeNil() };

        const context = createMockContext({
          customProperties: {
            query: {
              ...searchParams,
              ...conditionTreeParams,
              ...segmentParams,
              timezone: 'Europe/Paris',
            },
            params: { parentId: '2d162303-78bf-599e-b197-93590ac3d315' },
          },
          state: { user: { email: 'john.doe@domain.com' } },
        });

        const getScopeMock = services.authorization.getScope as jest.Mock;
        getScopeMock.mockResolvedValueOnce(
          ConditionTreeFactory.fromPlainObject({
            field: 'name',
            operator: 'NotContains',
            value: '[test]',
          }),
        );

        await count.handleCountRelated(context);

        expect(CollectionUtils.aggregateRelation).toHaveBeenCalledWith(
          dataSource.getCollection('books'),
          ['2d162303-78bf-599e-b197-93590ac3d315'],
          'myBookPersons',
          {
            email: 'john.doe@domain.com',
            requestId: expect.any(String),
            request: { ip: expect.any(String) },
            timezone: 'Europe/Paris',
          },
          new Filter({
            search: 'searched argument',
            searchExtended: false,
            segment: 'a-valid-segment',
            liveQuerySegment: expect.toBeNil(),
            conditionTree: ConditionTreeFactory.fromPlainObject({
              aggregator: 'And',
              conditions: [
                {
                  field: 'id',
                  operator: 'Equal',
                  value: '123e4567-e89b-12d3-a456-426614174000',
                },
                {
                  field: 'name',
                  operator: 'NotContains',
                  value: '[test]',
                },
              ],
            }),
          }),
          new Aggregation({ operation: 'Count' }),
        );

        expect(context.response.body).toEqual({ count: 1568 });

        expect(services.authorization.getScope).toHaveBeenCalledWith(
          dataSource.getCollection('bookPersons'),
          context,
        );
      });

      describe('when there is empty aggregate result', () => {
        test('should return 0', async () => {
          const { services, dataSource, options } = setupWithOneToManyRelation();

          const oneToManyRelationName = 'myBookPersons';
          const count = new CountRelatedRoute(
            services,
            options,
            dataSource,
            'books',
            oneToManyRelationName,
          );

          jest.spyOn(CollectionUtils, 'aggregateRelation').mockResolvedValue(null);

          const context = setupContext();
          await count.handleCountRelated(context);

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
          'books',
          oneToManyRelationName,
        );

        const customProperties = {
          query: { timezone: 'Europe/Paris' },
          params: { BAD_ATTRIBUTE: '1523' },
        };
        const context = createMockContext({ customProperties });
        const result = count.handleCountRelated(context);

        await expect(result).rejects.toThrow(ValidationError);
      });

      test('should return an HTTP 500 response when the aggregate has a problem', async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation();

        const oneToManyRelationName = 'myBookPersons';
        const count = new CountRelatedRoute(
          services,
          options,
          dataSource,
          'books',
          oneToManyRelationName,
        );

        jest.spyOn(CollectionUtils, 'aggregateRelation').mockImplementation(() => {
          throw new Error('an error');
        });

        const context = setupContext();
        await expect(count.handleCountRelated(context)).rejects.toThrow('an error');
      });
    });

    describe('when count is deactivated', () => {
      test('should return a predefined response', async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation(false);

        const count = new CountRelatedRoute(
          services,
          options,
          dataSource,
          'books',
          'myBookPersons',
        );
        const context = setupContext();

        await count.handleCountRelated(context);

        expect(context.response.body).toEqual({ meta: { count: 'deactivated' } });
      });
    });
  });

  describe('with special characters in names', () => {
    it('should register routes with escaped characters', () => {
      const services = factories.forestAdminHttpDriverServices.build();
      const options = factories.forestAdminHttpDriverOptions.build();
      const router = factories.router.mockAllMethods().build();

      const bookPersons = factories.collection.build({
        name: 'bookPersons+*?',
        schema: factories.collectionSchema.build({
          countable: true,
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
          },
        }),
      });

      const books = factories.collection.build({
        name: 'books+?*',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.uuidPrimaryKey().build(),
            myBookPersons: factories.oneToManySchema.build({
              foreignCollection: 'bookPersons+*?',
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollections([bookPersons, books]);

      const oneToManyRelationName = 'myBookPersons+*?';
      const count = new CountRelatedRoute(
        services,
        options,
        dataSource,
        'books+?*',
        oneToManyRelationName,
      );
      count.setupRoutes(router);

      expect(router.get).toHaveBeenCalledWith(
        '/books\\+\\?\\*/:parentId/relationships/myBookPersons\\+\\*\\?/count',
        expect.any(Function),
      );
    });
  });
});
