import { CollectionUtils, PaginatedFilter, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import ListRelatedRoute from '../../../src/routes/access/list-related';
import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';
import QueryStringParser from '../../../src/utils/query-string';

describe('ListRelatedRoute', () => {
  const setup = () => {
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
    const projectionParams = { 'fields[persons]': 'id,name' };
    const customProperties = {
      query: { ...projectionParams, timezone: 'Europe/Paris' },
      params: { parentId: '1523' },
    };

    return createMockContext({ customProperties });
  };

  test('should register the relation private route', () => {
    const { services, dataSource, options, router } = setup();

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
        const { services, dataSource, options } = setup();

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

        const context = setupContext();
        await count.handleListRelated(context);

        expect(CollectionUtils.listRelation).toHaveBeenCalledWith(
          dataSource.getCollection('books'),
          ['1523'],
          'myPersons',
          new PaginatedFilter({
            search: QueryStringParser.parseSearch(context),
            searchExtended: QueryStringParser.parseSearchExtended(context),
            timezone: QueryStringParser.parseTimezone(context),
            page: QueryStringParser.parsePagination(context),
            sort: QueryStringParser.parseSort(dataSource.getCollection('persons'), context),
            segment: QueryStringParser.parseSegment(dataSource.getCollection('persons'), context),
            conditionTree: QueryStringParser.parseConditionTree(
              dataSource.getCollection('persons'),
              context,
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
        const { services, dataSource, options } = setup();

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
        const { services, dataSource, options } = setup();

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
        const { services, dataSource, options } = setup();

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
