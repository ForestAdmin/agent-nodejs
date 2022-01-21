import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import Get from '../../../src/routes/access/get';
import * as factories from '../../__factories__';

describe('Get', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const partialCollection = {
    name: 'books',
    getById: jest.fn(),
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.build({
          columnType: PrimitiveTypes.Number,
          isPrimaryKey: true,
        }),
        name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
      },
    }),
  };
  const dataSource = factories.dataSource.buildWithCollection(partialCollection);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.get as jest.Mock).mockClear();
  });

  test('should register "/books/:id" private routes', () => {
    const get = new Get(services, dataSource, options, partialCollection.name);
    get.setupPrivateRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books/:id', expect.any(Function));
  });

  describe('handleGet', () => {
    test('should call the serializer using the getOne implementation', async () => {
      services.serializer.serialize = jest.fn().mockReturnValue('test');
      const get = new Get(services, dataSource, options, partialCollection.name);
      const context = createMockContext({
        customProperties: { params: { id: '1' } },
      });

      await get.handleGet(context);

      expect(services.serializer.serialize).toHaveBeenCalled();
      expect(partialCollection.getById).toHaveBeenCalledWith([1], ['id', 'name']);
      expect(context.response.body).toEqual('test');
    });

    describe('when an error happens', () => {
      test('should return an HTTP 500 response', async () => {
        services.serializer.serialize = jest.fn().mockImplementation(() => {
          throw new Error();
        });
        const get = new Get(services, dataSource, options, partialCollection.name);
        const context = createMockContext({
          customProperties: { params: { id: '1' } },
        });

        await get.handleGet(context);

        expect(context.throw).toHaveBeenCalledWith(
          500,
          'Failed to get record using id 1 on collection "books"',
        );
      });
    });
  });
});
