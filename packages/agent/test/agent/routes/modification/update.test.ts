import { Projection } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { CollectionActionEvent } from '../../../../src/agent/services/authorization';
import UpdateRoute from '../../../../src/agent/routes/modification/update';

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
    it('should call the update action successfully when providing a valid request', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        update: jest.fn(),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build({
              columnType: 'Number',
            }),
            name: factories.columnSchema.build({
              columnType: 'String',
            }),
          },
        }),
      });
      bookCollection.list = jest.fn().mockResolvedValue([{ id: '1523', name: 'foo name' }]);
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const updateRoute = new UpdateRoute(services, options, dataSource, 'books');

      const customProperties = { query: { timezone: 'Europe/Paris' }, params: { id: '1523' } };
      const requestBody = { data: { attributes: { name: 'foo name' } } };
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties,
        requestBody,
      });

      await updateRoute.handleUpdate(context);

      const expectedFilter = factories.filter.build({
        conditionTree: factories.conditionTreeLeaf.build({
          operator: 'Equal',
          value: 1523,
          field: 'id',
        }),
      });

      expect(bookCollection.update).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        expectedFilter,
        { name: 'foo name' },
      );
      expect(bookCollection.list).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        expectedFilter,
        new Projection('id', 'name'),
      );
      expect(context.response.body).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({ attributes: { id: '1523', name: 'foo name' } }),
        }),
      );
    });

    it('should remove relationship before update', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build({
              columnType: 'Number',
            }),
          },
        }),
      });
      bookCollection.list = jest.fn().mockResolvedValue([{ id: '1523' }]);
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const updateRoute = new UpdateRoute(services, options, dataSource, 'books');

      const customProperties = { query: { timezone: 'Europe/Paris' }, params: { id: '1523' } };
      const requestBody = {
        data: {
          attributes: { id: 1 },
          relationships: {
            library: { data: { id: '1', type: 'companies' } },
          },
        },
      };
      const context = createMockContext({ customProperties, requestBody });

      const spy = jest.spyOn(services.serializer, 'deserialize');

      await updateRoute.handleUpdate(context);

      expect(spy).toHaveBeenCalledWith(dataSource.getCollection('books'), {
        data: { attributes: { id: 1 } },
      });
    });

    it('should check that the user is authorized', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        update: jest.fn(),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build({
              columnType: 'Number',
            }),
            name: factories.columnSchema.build({
              columnType: 'String',
            }),
          },
        }),
      });
      bookCollection.list = jest.fn().mockResolvedValue([{ id: '1523', name: 'foo name' }]);
      const dataSource = factories.dataSource.buildWithCollection(bookCollection);
      const updateRoute = new UpdateRoute(services, options, dataSource, 'books');

      const customProperties = { query: { timezone: 'Europe/Paris' }, params: { id: '1523' } };
      const requestBody = { data: { attributes: { name: 'foo name' } } };
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        customProperties,
        requestBody,
      });

      await updateRoute.handleUpdate(context);

      expect(services.authorization.assertCanOnCollection).toHaveBeenCalledWith(
        context,
        CollectionActionEvent.Edit,
        'books',
      );
    });
  });
});
