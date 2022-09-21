import {
  ConditionTreeFactory,
  PaginatedFilter,
  ProjectionFactory,
} from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { CollectionActionEvent } from '../../../../src/agent/services/authorization';
import { HttpCode } from '../../../../src/agent/types';
import Get from '../../../../src/agent/routes/access/get';
import QueryStringParser from '../../../../src/agent/utils/query-string';

describe('GetRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          name: factories.columnSchema.build({ columnType: 'String' }),
          author: factories.oneToOneSchema.build({
            foreignCollection: 'persons',
            originKey: 'bookId',
            originKeyTarget: 'id',
          }),
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          bookId: factories.columnSchema.build({ columnType: 'Uuid' }),
        },
      }),
    }),
  ]);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.get as jest.Mock).mockClear();
  });

  test('should register "/books/:id" route', () => {
    const get = new Get(services, options, dataSource, 'books');
    get.setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books/:id', expect.any(Function));
  });

  describe('handleGet', () => {
    test('should call the serializer using the getOne implementation', async () => {
      jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([{ title: 'test ' }]);
      services.serializer.serialize = jest.fn().mockReturnValue('test');
      const get = new Get(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris' },
          params: { id: '2d162303-78bf-599e-b197-93590ac3d315' },
        },
      });

      await get.handleGet(context);

      expect(dataSource.getCollection('books').list).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        {
          conditionTree: {
            field: 'id',
            operator: 'Equal',
            value: '2d162303-78bf-599e-b197-93590ac3d315',
          },
        },
        ['id', 'name', 'author:id', 'author:bookId'],
      );
      expect(services.serializer.serialize).toHaveBeenCalled();

      expect(context.response.body).toEqual('test');
    });

    test('should check that the user has permission to get', async () => {
      jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([{ title: 'test ' }]);
      services.serializer.serialize = jest.fn().mockReturnValue('test');
      const get = new Get(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris' },
          params: { id: '2d162303-78bf-599e-b197-93590ac3d315' },
        },
      });

      await get.handleGet(context);

      expect(services.authorization.assertCanOnCollection).toHaveBeenCalledWith(
        context,
        CollectionActionEvent.Read,
        'books',
      );

      expect(context.response.body).toEqual('test');
    });

    test('it should apply the scope', async () => {
      jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([{ title: 'test ' }]);
      services.serializer.serialize = jest.fn().mockReturnValue('test');
      const get = new Get(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { timezone: 'Europe/Paris' },
          params: { id: '2d162303-78bf-599e-b197-93590ac3d315' },
        },
      });

      const getScopeMock = services.authorization.getScope as jest.Mock;
      getScopeMock.mockResolvedValueOnce({
        field: 'title',
        operator: 'NotContains',
        value: '[test]',
      });

      await get.handleGet(context);

      expect(services.authorization.getScope).toHaveBeenCalledWith(
        dataSource.getCollection('books'),
        context,
      );

      expect(dataSource.getCollection('books').list).toHaveBeenCalledWith(
        QueryStringParser.parseCaller(context),
        new PaginatedFilter({
          conditionTree: ConditionTreeFactory.fromPlainObject({
            aggregator: 'And',
            conditions: [
              {
                field: 'id',
                operator: 'Equal',
                value: '2d162303-78bf-599e-b197-93590ac3d315',
              },
              {
                field: 'title',
                operator: 'NotContains',
                value: '[test]',
              },
            ],
          }),
        }),
        ProjectionFactory.all(dataSource.getCollection('books')),
      );

      expect(context.response.body).toEqual('test');
    });

    describe('when an error happens', () => {
      describe('when list returns []', () => {
        test('should return an HTTP 404 response', async () => {
          jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([]);
          const get = new Get(services, options, dataSource, 'books');
          const context = createMockContext({
            customProperties: {
              query: { timezone: 'Europe/Paris' },
              params: { id: '2d162303-78bf-599e-b197-93590ac3d315' },
            },
          });

          await get.handleGet(context);

          expect(context.throw).toHaveBeenCalledWith(HttpCode.NotFound, 'Record does not exists');
          expect(context.throw).toHaveBeenCalledTimes(1);
        });
      });
    });
  });
});
