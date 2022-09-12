import { DataSource, Projection, ValidationError } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../../__factories__';
import { CollectionActionEvent } from '../../../../src/agent/utils/types';
import UpdateField from '../../../../src/agent/routes/modification/update-field';

describe('UpdateField', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const services = factories.forestAdminHttpDriverServices.build();
  const router = factories.router.mockAllMethods().build();

  test('should register PUT /books/:id/relationships/:field/:index route', () => {
    const bookCollection = factories.collection.build({ name: 'books' });
    const dataSource = factories.dataSource.buildWithCollections([bookCollection]);
    const updateRoute = new UpdateField(services, options, dataSource, 'books');

    updateRoute.setupRoutes(router);

    expect(router.put).toHaveBeenCalledWith(
      '/books/:id/relationships/:field/:index(\\d+)',
      expect.any(Function),
    );
  });

  describe('handleUpdate', () => {
    let dataSource: DataSource;

    beforeEach(() => {
      dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build({
                columnType: 'Number',
              }),
              itemList: factories.columnSchema.build({
                columnType: [{ key: 'String', value: 'String' }],
              }),
            },
          }),
          list: jest.fn().mockResolvedValue([
            {
              id: '1523',
              itemList: [
                { key: 'key1', value: 'value1' },
                { key: 'key2', value: 'value2' },
              ],
            },
          ]),
          update: jest.fn(),
        }),
      );
    });

    it('should throw if the field does not exists', async () => {
      const updateRoute = new UpdateField(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        requestBody: { data: { attributes: { key: 'newKey', value: 'newValue' } } },
        customProperties: {
          query: { timezone: 'Europe/Paris' },
          params: { id: '1523', field: 'otherField', index: '1' },
        },
      });

      await expect(() => updateRoute.handleUpdate(context)).rejects.toThrow(ValidationError);
    });

    it('should throw if the array is too short', async () => {
      const updateRoute = new UpdateField(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        requestBody: { data: { attributes: { key: 'newKey', value: 'newValue' } } },
        customProperties: {
          query: { timezone: 'Europe/Paris' },
          params: { id: '1523', field: 'itemList', index: '456' },
        },
      });

      await expect(() => updateRoute.handleUpdate(context)).rejects.toThrow(ValidationError);
    });

    it('should call the update action successfully when providing a valid request', async () => {
      const updateRoute = new UpdateField(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        requestBody: { data: { attributes: { key: 'newKey', value: 'newValue' } } },
        customProperties: {
          query: { timezone: 'Europe/Paris' },
          params: { id: '1523', field: 'itemList', index: '1' },
        },
      });

      await updateRoute.handleUpdate(context);

      const expectedFilter = factories.filter.build({
        conditionTree: factories.conditionTreeLeaf.build({
          operator: 'Equal',
          value: 1523,
          field: 'id',
        }),
      });

      expect(dataSource.getCollection('books').list).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        expectedFilter,
        new Projection('itemList'),
      );
      expect(dataSource.getCollection('books').update).toHaveBeenCalledWith(
        { email: 'john.doe@domain.com', timezone: 'Europe/Paris' },
        expectedFilter,
        {
          itemList: [
            { key: 'key1', value: 'value1' },
            { key: 'newKey', value: 'newValue' },
          ],
        },
      );
      expect(context.response.status).toEqual(204);
    });

    it('should check that the user is authorized', async () => {
      const updateRoute = new UpdateField(services, options, dataSource, 'books');
      const context = createMockContext({
        state: { user: { email: 'john.doe@domain.com' } },
        requestBody: { data: { attributes: { key: 'newKey', value: 'newValue' } } },
        customProperties: {
          query: { timezone: 'Europe/Paris' },
          params: { id: '1523', field: 'itemList', index: '1' },
        },
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
