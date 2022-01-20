import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import List from '../../src/routes/list';
import * as factories from '../__factories__';

describe('List', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const partialCollection = {
    name: 'books',
    list: jest.fn(),
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.build({
          columnType: PrimitiveTypes.Uuid,
          isPrimaryKey: true,
        }),
      },
    }),
  };
  const dataSource = factories.dataSource.buildWithCollection(partialCollection);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.get as jest.Mock).mockClear();
  });

  test('should register "/books" private routes', () => {
    const list = new List(services, dataSource, options, partialCollection.name);
    list.setupPrivateRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books', expect.any(Function));
  });

  describe('handleList', () => {
    test('should call the serializer using the list implementation', async () => {
      services.serializer.serialize = jest.fn().mockReturnValue('test');
      const list = new List(services, dataSource, options, partialCollection.name);
      const context = {
        request: { query: { 'fields[books]': 'id' } },
        response: {},
      } as unknown as Context;

      await list.handleList(context);
      expect(services.serializer.serialize).toHaveBeenCalled();
      expect(partialCollection.list).toHaveBeenCalledWith({}, ['id']);
      expect(context.response.body).toEqual('test');
    });

    describe('when an error happens', () => {
      test('should return an HTTP 400 response', async () => {
        services.serializer.serialize = jest.fn().mockImplementation(() => {
          throw new Error();
        });

        const list = new List(services, dataSource, options, partialCollection.name);
        const throwSpy = jest.fn();
        const context = {
          request: { query: { 'fields[books]': 'id' } },
          response: {},
          throw: throwSpy,
        } as unknown as Context;

        await list.handleList(context);
        expect(throwSpy).toHaveBeenCalledWith(500, 'Failed to list collection "books"');
      });
    });
  });
});
