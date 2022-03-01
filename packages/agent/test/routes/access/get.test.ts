import { PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { HttpCode } from '../../../src/types';
import Get from '../../../src/routes/access/get';

describe('GetRoute', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const dataSource = factories.dataSource.buildWithCollections([
    factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          name: factories.columnSchema.build({
            columnType: PrimitiveTypes.String,
          }),
          author: factories.oneToOneSchema.build({
            foreignCollection: 'persons',
            foreignKey: 'bookId',
          }),
        },
      }),
    }),
    factories.collection.build({
      name: 'persons',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.isPrimaryKey().build(),
          bookId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
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
        customProperties: { params: { id: '2d162303-78bf-599e-b197-93590ac3d315' } },
      });

      await get.handleGet(context);

      expect(context.throw).not.toHaveBeenCalled();
      expect(dataSource.getCollection('books').list).toHaveBeenCalledWith(
        {
          conditionTree: {
            field: 'id',
            operator: 'equal',
            value: '2d162303-78bf-599e-b197-93590ac3d315',
          },
        },
        ['id', 'name', 'author:id', 'author:bookId'],
      );
      expect(services.serializer.serialize).toHaveBeenCalled();

      expect(context.response.body).toEqual('test');
    });

    describe('when an error happens', () => {
      describe('when list returns []', () => {
        test('should return an HTTP 404 response', async () => {
          jest.spyOn(dataSource.getCollection('books'), 'list').mockResolvedValue([]);
          const get = new Get(services, options, dataSource, 'books');
          const context = createMockContext({
            customProperties: { params: { id: '2d162303-78bf-599e-b197-93590ac3d315' } },
          });

          await get.handleGet(context);

          expect(context.throw).toHaveBeenCalledWith(HttpCode.NotFound, 'Record does not exists');
          expect(context.throw).toHaveBeenCalledTimes(1);
        });
      });

      describe('when the provided id does not match the schema definition', () => {
        test('should return an HTTP 400 response', async () => {
          const get = new Get(services, options, dataSource, 'books');
          // In the schema above, ID is a classic primary key
          // Asking for a composite PK will throw
          const context = createMockContext({
            customProperties: { params: { id: '1|2' } },
          });

          await expect(get.handleGet(context)).rejects.toThrow('Expected 1 values, found 2');
        });
      });

      describe('if either list or serialize failed', () => {
        test('should return an HTTP 500 response', async () => {
          jest
            .spyOn(dataSource.getCollection('books'), 'list')
            .mockResolvedValue([{ title: 'test ' }]);

          services.serializer.serialize = jest.fn().mockImplementation(() => {
            throw new Error('failed to serialize');
          });

          const get = new Get(services, options, dataSource, 'books');
          const context = createMockContext({
            customProperties: { params: { id: '2d162303-78bf-599e-b197-93590ac3d315' } },
          });

          await expect(get.handleGet(context)).rejects.toThrow('failed to serialize');
        });
      });
    });
  });
});
