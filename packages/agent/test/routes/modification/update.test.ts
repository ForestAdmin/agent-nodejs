import { ConditionTreeFactory, Projection } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import UpdateRoute from '../../../src/routes/modification/update';
import * as factories from '../../__factories__';

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
            id: factories.columnSchema.numericPrimaryKey().build(),
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
      const requestBody = { data: { id: '1523', attributes: { name: 'foo name' } } };
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
        { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
        expectedFilter,
        { name: 'foo name' },
      );
      expect(bookCollection.list).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
        expectedFilter,
        new Projection('id', 'name'),
      );
      expect(context.response.body).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({ attributes: { id: '1523', name: 'foo name' } }),
        }),
      );
    });

    it('should apply the scope', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        update: jest.fn(),
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build({
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

      const getScopeMock = services.authorization.getScope as jest.Mock;
      getScopeMock.mockReturnValue({ field: 'title', operator: 'NotContains', value: '[test]' });

      await updateRoute.handleUpdate(context);

      const expectedFilter = factories.filter.build({
        conditionTree: ConditionTreeFactory.fromPlainObject({
          aggregator: 'And',
          conditions: [
            {
              operator: 'Equal',
              value: 1523,
              field: 'id',
            },
            { field: 'title', operator: 'NotContains', value: '[test]' },
          ],
        }),
      });

      expect(bookCollection.update).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
        expectedFilter,
        { name: 'foo name' },
      );
      expect(bookCollection.list).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', requestId: expect.any(String), timezone: 'Europe/Paris' },
        expectedFilter,
        new Projection('id', 'name'),
      );

      expect(services.authorization.getScope).toHaveBeenCalledWith(
        dataSource.getCollection('books'),
        context,
      );
    });

    it('should remove relationship before update', async () => {
      const bookCollection = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.numericPrimaryKey().build(),
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
            id: factories.columnSchema.numericPrimaryKey().build({
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

      expect(services.authorization.assertCanEdit).toHaveBeenCalledWith(context, 'books');
    });
  });
});
