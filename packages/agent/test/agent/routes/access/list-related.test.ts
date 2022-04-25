import {
  CollectionUtils,
  ConditionTreeLeaf,
  Page,
  PaginatedFilter,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import ListRelatedRoute from '../../../../src/agent/routes/access/list-related';

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
          name: factories.columnSchema.build({ columnType: 'String' }),
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

  test('should register the relation private route', () => {
    const { services, dataSource, options, router } = setupWithOneToManyRelation();

    const count = new ListRelatedRoute(services, options, dataSource, 'books', 'myPersons');
    count.setupRoutes(router);

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

        const count = new ListRelatedRoute(services, options, dataSource, 'books', 'myPersons');

        jest.spyOn(CollectionUtils, 'listRelation').mockResolvedValue([
          { id: 1, name: 'aName' },
          { id: 2, name: 'aName2' },
        ]);

        const searchParams = { search: 'aName' };
        const conditionTreeParams = {
          filters: JSON.stringify({
            aggregator: 'And',
            conditions: [
              { field: 'id', operator: 'Equal', value: '123e4567-e89b-12d3-a456-426614174000' },
            ],
          }),
        };
        const segmentParams = { segment: 'a-valid-segment' };
        const projectionParams = { 'fields[persons]': 'id,name' };
        const context = createMockContext({
          state: { user: { email: 'john.doe@domain.com' } },
          customProperties: {
            params: { parentId: '2d162303-78bf-599e-b197-93590ac3d315' },
            query: {
              ...searchParams,
              ...conditionTreeParams,
              ...segmentParams,
              ...projectionParams,
              timezone: 'Europe/Paris',
            },
          },
        });
        await count.handleListRelated(context);

        expect(CollectionUtils.listRelation).toHaveBeenCalledWith(
          dataSource.getCollection('books'),
          ['2d162303-78bf-599e-b197-93590ac3d315'],
          'myPersons',
          { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
          new PaginatedFilter({
            search: 'aName',
            searchExtended: false,
            page: new Page(0, 15),
            sort: new Sort({ field: 'id', ascending: true }),
            segment: 'a-valid-segment',
            conditionTree: new ConditionTreeLeaf(
              'id',
              'Equal',
              '123e4567-e89b-12d3-a456-426614174000',
            ),
          }),
          ['id', 'name'],
        );
        expect(context.response.body).toEqual({
          data: [
            { attributes: { id: 1, name: 'aName' }, id: '1', type: 'persons' },
            { attributes: { id: 2, name: 'aName2' }, id: '2', type: 'persons' },
          ],
          jsonapi: { version: '1.0' },
          meta: {
            decorators: {
              0: { id: '1', search: ['name'] },
              1: { id: '2', search: ['name'] },
            },
          },
        });
      });
    });
  });
});
