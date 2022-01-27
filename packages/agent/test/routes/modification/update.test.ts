import { createMockContext } from '@shopify/jest-koa-mocks';
import { PrimitiveTypes, Operator } from '@forestadmin/datasource-toolkit';
import UpdateRoute from '../../../dist/routes/modification/update';
import * as factories from '../../__factories__';
import { HttpCode } from '../../../dist/types';

describe('UpdateRoute', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();

  test('should register "/books" private routes', () => {
    const bookCollection = factories.collection.build({ name: 'books' });
    const dataSource = factories.dataSource.buildWithCollections([bookCollection]);
    const updateRoute = new UpdateRoute(services, dataSource, options, 'books');

    updateRoute.setupPrivateRoutes(router);

    expect(router.put).toHaveBeenCalledWith('/books/:id', expect.any(Function));
  });

  describe('handleUpdate', () => {
    it('should throw an error when the id attribute is not provided', async () => {
      const bookCollection = factories.collection.build({ name: 'books' });
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const updateRoute = new UpdateRoute(services, dataSource, options, 'books');

      updateRoute.setupPrivateRoutes(router);

      const customProperties = { params: { badParam: '1523|1524' } };
      const context = createMockContext({ customProperties });

      await updateRoute.handleUpdate(context);

      await expect(context.throw).toHaveBeenCalledWith(HttpCode.BadRequest, expect.any(String));
    });

    it('should throw an error when the delete action failed', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        update: jest.fn().mockImplementation(() => {
          throw new Error('an error');
        }),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({
              columnType: PrimitiveTypes.Number,
              isPrimaryKey: true,
            }),
            name: factories.columnSchema.build({
              columnType: PrimitiveTypes.String,
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const updateRoute = new UpdateRoute(services, dataSource, options, 'books');

      updateRoute.setupPrivateRoutes(router);

      const customProperties = { params: { id: '1523' } };
      const requestBody = { data: { attributes: { name: 'foo name' } } };
      const context = createMockContext({ customProperties, requestBody });

      await updateRoute.handleUpdate(context);

      expect(context.throw).toHaveBeenCalledWith(HttpCode.InternalServerError, expect.any(String));
    });

    it('should call the update action successfully when providing a right request', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        update: jest.fn(),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({
              columnType: PrimitiveTypes.Number,
              isPrimaryKey: true,
            }),
            name: factories.columnSchema.build({
              columnType: PrimitiveTypes.String,
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const updateRoute = new UpdateRoute(services, dataSource, options, 'books');

      updateRoute.setupPrivateRoutes(router);

      const customProperties = { params: { id: '1523' } };
      const requestBody = { data: { attributes: { name: 'foo name' } } };
      const context = createMockContext({ customProperties, requestBody });

      await updateRoute.handleUpdate(context);

      expect(bookCollection.update).toHaveBeenCalledWith(
        factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            operator: Operator.Equal,
            value: 1523,
            field: 'id',
          }),
        }),
        { name: 'foo name' },
      );
    });
  });
});
