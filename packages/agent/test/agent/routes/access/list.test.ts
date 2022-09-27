import { Projection } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import List from '../../../../src/agent/routes/access/list';

describe('ListRoute', () => {
  const setup = () => {
    const collection = factories.collection.build({
      name: 'books',
      list: jest.fn(),
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
        },
      }),
    });
    const dataSource = factories.dataSource.buildWithCollection(collection);
    const options = factories.forestAdminHttpDriverOptions.build();
    const router = factories.router.mockAllMethods().build();
    const services = factories.forestAdminHttpDriverServices.build();

    return { dataSource, options, router, services, collection };
  };

  test('should register "/books" route', () => {
    const { dataSource, options, router, services, collection } = setup();
    const list = new List(services, options, dataSource, collection.name);
    list.setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books', expect.any(Function));
  });

  describe('handleList', () => {
    test('should call the serializer using the list implementation', async () => {
      // given
      const { dataSource, options, services, collection } = setup();

      const list = new List(services, options, dataSource, collection.name);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { search: '2', 'fields[books]': 'id', timezone: 'Europe/Paris' },
        },
      });
      jest.spyOn(collection, 'list').mockResolvedValue([{ id: 1 }, { id: 2 }]);

      // when
      await list.handleList(context);

      // then
      expect(collection.list).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        {
          conditionTree: null,
          search: '2',
          searchExtended: false,
          segment: null,
          page: { limit: 15, skip: 0 },
          sort: [{ ascending: true, field: 'id' }],
        },
        new Projection('id'),
      );
      expect(context.response.body).toEqual({
        jsonapi: { version: '1.0' },
        data: [
          { type: 'books', id: '1', attributes: { id: 1 } },
          { type: 'books', id: '2', attributes: { id: 2 } },
        ],
        meta: { decorators: { 0: { id: '2', search: ['id'] } } },
      });
    });

    test('should check that the user has permission to list elements', async () => {
      const { dataSource, options, services, collection } = setup();

      const list = new List(services, options, dataSource, collection.name);
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties: {
          query: { search: '2', 'fields[books]': 'id', timezone: 'Europe/Paris' },
        },
      });
      jest.spyOn(collection, 'list').mockResolvedValue([{ id: 1 }, { id: 2 }]);

      await list.handleList(context);

      expect(services.authorization.assertCanBrowse).toHaveBeenLastCalledWith(context, 'books');
    });
  });
});
