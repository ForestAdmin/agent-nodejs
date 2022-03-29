import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import List from '../../../../src/agent/routes/access/list';

describe('ListRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const partialCollection = {
    name: 'books',
    list: jest.fn(),
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
      },
    }),
  };
  const dataSource = factories.dataSource.buildWithCollection(partialCollection);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.get as jest.Mock).mockClear();
  });

  test('should register "/books" route', () => {
    const list = new List(services, options, dataSource, partialCollection.name);
    list.setupRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books', expect.any(Function));
  });

  describe('handleList', () => {
    test('should call the serializer using the list implementation', async () => {
      services.serializer.serialize = jest.fn().mockReturnValue('test');
      const list = new List(services, options, dataSource, partialCollection.name);
      const context = createMockContext({
        customProperties: { query: { 'fields[books]': 'id', timezone: 'Europe/Paris' } },
      });

      await list.handleList(context);

      expect(services.serializer.serialize).toHaveBeenCalled();
      expect(partialCollection.list).toHaveBeenCalledWith(
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
        ['id'],
      );
      expect(context.response.body).toEqual('test');
    });
  });
});
