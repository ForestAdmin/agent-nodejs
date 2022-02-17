import { Operator, PrimitiveTypes } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import UpdateRoute from '../../../src/routes/modification/update';

describe('UpdateRoute', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();

  test('should register PUT books/:id route', () => {
    const bookCollection = factories.collection.build({ name: 'books' });
    const dataSource = factories.dataSource.buildWithCollections([bookCollection]);
    const updateRoute = new UpdateRoute(services, options, dataSource, 'books');

    updateRoute.setupRoutes(router);

    expect(router.put).toHaveBeenCalledWith('/books/:id', expect.any(Function));
  });

  describe('handleUpdate', () => {
    it('should throw an error when the id attribute is not provided', async () => {
      const bookCollection = factories.collection.build({ name: 'books' });
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const updateRoute = new UpdateRoute(services, options, dataSource, 'books');

      updateRoute.setupRoutes(router);

      const customProperties = { params: { badParam: '1523|1524' } };
      const context = createMockContext({ customProperties });

      await expect(updateRoute.handleUpdate(context)).rejects.toThrow(
        'Expected string, received: undefined',
      );
    });

    it('should throw an error when a given attribute is not valid', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build({
              columnType: PrimitiveTypes.Number,
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const updateRoute = new UpdateRoute(services, options, dataSource, 'books');

      const customProperties = { params: { id: '1523' } };
      const requestBody = { data: { attributes: { notExistField: 'foo' } } };
      const context = createMockContext({ customProperties, requestBody });

      await expect(updateRoute.handleUpdate(context)).rejects.toThrow(
        'Unknown field "notExistField"',
      );
    });

    it('should throw an error when the update action failed', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        update: jest.fn().mockImplementation(() => {
          throw new Error('an error');
        }),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build({
              columnType: PrimitiveTypes.Number,
            }),
            name: factories.columnSchema.build({
              columnType: PrimitiveTypes.String,
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const updateRoute = new UpdateRoute(services, options, dataSource, 'books');

      const customProperties = { params: { id: '1523' } };
      const requestBody = { data: { attributes: { name: 'foo name' } } };
      const context = createMockContext({ customProperties, requestBody });

      await expect(updateRoute.handleUpdate(context)).rejects.toThrow('an error');
    });

    it('should call the update action successfully when providing a valid request', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        update: jest.fn(),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build({
              columnType: PrimitiveTypes.Number,
            }),
            name: factories.columnSchema.build({
              columnType: PrimitiveTypes.String,
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const updateRoute = new UpdateRoute(services, options, dataSource, 'books');

      const customProperties = { params: { id: '1523' } };
      const requestBody = { data: { attributes: { name: 'foo name' } } };
      const context = createMockContext({ customProperties, requestBody });

      await updateRoute.handleUpdate(context);

      expect(context.throw).not.toHaveBeenCalled();
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
