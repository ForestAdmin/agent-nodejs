import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import Get from '../../../src/routes/access/get';
import * as factories from '../../__factories__';

describe('GetRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
          name: factories.columnSchema.build({
            columnType: PrimitiveTypes.String,
          }),
          author: factories.oneToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'authorId',
          }),
          authorId: { columnType: PrimitiveTypes.Number },
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({
            columnType: PrimitiveTypes.Uuid,
            isPrimaryKey: true,
          }),
        },
      }),
    }),
  ]);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.get as jest.Mock).mockClear();
  });

  test('should register "/books/:id" private routes', () => {
    const get = new Get(services, dataSource, options, 'books');
    get.setupPrivateRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books/:id', expect.any(Function));
  });

  describe('handleGet', () => {
    test('should call the serializer using the getOne implementation', async () => {
      services.serializer.serialize = jest.fn().mockReturnValue('test');
      const get = new Get(services, dataSource, options, 'books');
      const context = createMockContext({
        customProperties: { params: { id: '1' } },
      });

      await get.handleGet(context);

      expect(services.serializer.serialize).toHaveBeenCalled();

      expect(dataSource.getCollection('books').getById).toHaveBeenCalledWith(
        ['1'],
        ['id', 'name', 'author:id'],
      );
      expect(context.response.body).toEqual('test');
    });

    describe('when an error happens', () => {
      describe('when getById returns null', () => {
        test('should return an HTTP 404 response', async () => {
          jest.spyOn(dataSource.getCollection('books'), 'getById').mockImplementation(() => null);
          const get = new Get(services, dataSource, options, 'books');
          const context = createMockContext({
            customProperties: { params: { id: '1' } },
          });

          await get.handleGet(context);

          expect(context.throw).toHaveBeenCalledWith(
            404,
            'Record id 1 does not exist on collection "books"',
          );
        });
      });

      describe('when the provided id does not match the schema definition', () => {
        test('should return an HTTP 404 response', async () => {
          const get = new Get(services, dataSource, options, 'books');
          // In the schema above, ID is a classic primary key
          // Asking for a composite PK will throw
          const context = createMockContext({
            customProperties: { params: { id: '1|2' } },
          });

          await get.handleGet(context);

          expect(context.throw).toHaveBeenCalledWith(
            404,
            'Failed to get record using id 1|2, Expected 1 values, found 2',
          );
        });
      });

      describe('if either getById or serialize failed', () => {
        test('should return an HTTP 500 response', async () => {
          services.serializer.serialize = jest.fn().mockImplementation(() => {
            throw new Error();
          });
          const get = new Get(services, dataSource, options, 'books');
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
});
