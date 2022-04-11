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
      const { dataSource, options, services, collection } = setup();

      services.serializer.serialize = jest.fn().mockReturnValue('expected_response_body');
      const list = new List(services, options, dataSource, collection.name);
      const context = createMockContext({
        customProperties: { query: { 'fields[books]': 'id', timezone: 'Europe/Paris' } },
      });

      await list.handleList(context);

      expect(collection.list).toHaveBeenCalledWith(
        {
          conditionTree: null,
          search: null,
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
        new Projection('id'),
      );
      expect(services.serializer.serialize).toHaveBeenCalled();
      expect(context.response.body).toEqual('expected_response_body');
    });
  });
});
