import {
  CollectionUtils,
  PaginatedFilter,
  PrimitiveTypes,
  Sort,
  Page,
  ConditionTreeLeaf,
  Operator,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import ListRelatedRoute from '../../../src/routes/access/list-related';
import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';

describe('ListRelatedRoute', () => {
  const setupWithOneToManyRelation = () => {
    const services = factories.forestAdminHttpDriverServices.build();
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();

    const persons = factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
        },
      }),
    });

    const books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          myPersons: factories.oneToManySchema.build({
            foreignCollection: 'persons',
          }),
        },
      }),
    });
    const dataSource = factories.dataSource.buildWithCollections([persons, books]);

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

  test('should register the relation private route', () => {
    const { services, dataSource, options, router } = setupWithOneToManyRelation();

    const count = new ListRelatedRoute(
      services,
      options,
      dataSource,
      dataSource.getCollection('books').name,
      'myPersons',
    );
    count.setupPrivateRoutes(router);

    expect(router.get).toHaveBeenCalledWith(
      '/books/:parentId/relationships/myPersons',
      expect.any(Function),
    );
  });

  describe('handleListRelated', () => {
    describe('when the request is correct', () => {
      test('should return the record result', async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation();
        dataSource.getCollection('persons').schema.segments = ['a-valid-segment'];

        const count = new ListRelatedRoute(
          services,
          options,
          dataSource,
          dataSource.getCollection('books').name,
          'myPersons',
        );

        jest.spyOn(CollectionUtils, 'listRelation').mockResolvedValue([
          { id: 1, name: 'aName' },
          { id: 2, name: 'aName2' },
        ]);

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
        const projectionParams = { 'fields[persons]': 'id,name' };
        const customProperties = {
          query: {
            ...searchParams,
            ...filtersParams,
            ...segmentParams,
            ...projectionParams,
            timezone: 'Europe/Paris',
          },
          params: { parentId: '1523' },
        };
        const context = createMockContext({ customProperties });
        await count.handleListRelated(context);

        expect(CollectionUtils.listRelation).toHaveBeenCalledWith(
          dataSource.getCollection('books'),
          ['1523'],
          'myPersons',
          new PaginatedFilter({
            search: 'searched argument',
            searchExtended: false,
            timezone: 'Europe/Paris',
            page: new Page(0, 15),
            sort: new Sort({ field: 'id', ascending: true }),
            segment: 'a-valid-segment',
            conditionTree: new ConditionTreeLeaf(
              'id',
              Operator.Equal,
              '123e4567-e89b-12d3-a456-426614174000',
            ),
          }),
          ['id', 'name'],
        );
        expect(context.throw).not.toHaveBeenCalled();
        expect(context.response.body).toEqual({
          data: [
            { attributes: { id: 1, name: 'aName' }, id: '1', type: 'persons' },
            { attributes: { id: 2, name: 'aName2' }, id: '2', type: 'persons' },
          ],
          jsonapi: { version: '1.0' },
        });
      });
    });

    describe('when an error happens', () => {
      test('should return an HTTP 400 response when the projection is malformed', async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation();

        const count = new ListRelatedRoute(
          services,
          options,
          dataSource,
          dataSource.getCollection('books').name,
          'myPersons',
        );

        const malformedProjectionParams = { 'fields[persons]': 'id,BAD_ATTRIBUTE' };
        const customProperties = {
          query: { ...malformedProjectionParams, timezone: 'Europe/Paris' },
          params: { parentId: '1523' },
        };
        const context = createMockContext({ customProperties });
        await count.handleListRelated(context);

        expect(context.throw).toHaveBeenCalledWith(
          HttpCode.BadRequest,
          "Invalid projection (Cannot read property 'type' of undefined)",
        );
      });

      test('should return an HTTP 400 response when the parent id is malformed', async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation();

        const count = new ListRelatedRoute(
          services,
          options,
          dataSource,
          dataSource.getCollection('books').name,
          'myPersons',
        );

        const customProperties = {
          query: { 'fields[persons]': 'id,name', timezone: 'Europe/Paris' },
          params: { BAD_PARENT_ID: '1523' },
        };
        const context = createMockContext({ customProperties });
        await count.handleListRelated(context);

        expect(context.throw).toHaveBeenCalledWith(
          HttpCode.BadRequest,
          'Expected string, received: undefined',
        );
      });

      test('should return an HTTP 500 response when the list has a problem', async () => {
        const { services, dataSource, options } = setupWithOneToManyRelation();

        const count = new ListRelatedRoute(
          services,
          options,
          dataSource,
          dataSource.getCollection('books').name,
          'myPersons',
        );

        jest.spyOn(CollectionUtils, 'listRelation').mockImplementation(() => {
          throw new Error();
        });

        const context = setupContext();
        await count.handleListRelated(context);

        expect(context.throw).toHaveBeenCalledWith(
          HttpCode.InternalServerError,
          'Failed to get the collection relation of the "books"',
        );
      });
    });
  });
});
