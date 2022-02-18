import { ConditionTreeLeaf, Operator } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';

import * as factories from '../__factories__';
import ForestHttpApi from '../../src/utils/forest-http-api';
import PermissionService from '../../src/services/permissions';

jest.mock('../../src/utils/forest-http-api', () => ({
  getPermissions: jest.fn(),
}));

const getPermissions = ForestHttpApi.getPermissions as jest.Mock;

describe('Permissions', () => {
  const options = factories.forestAdminHttpDriverOptions.build({ isProduction: true });
  const collection = factories.collection.build({
    name: 'books',
    schema: factories.collectionSchema.build({
      fields: { id: factories.columnSchema.isPrimaryKey().build() },
    }),
  });

  let service: PermissionService;
  beforeEach(() => {
    service = new PermissionService(options);
    jest.resetAllMocks();
  });

  describe('with no scopes activated', () => {
    beforeEach(() => {
      getPermissions.mockResolvedValue({
        actions: new Set(),
        actionsByUser: { 'browse:books': new Set([1]) },
        scopes: { books: null },
      });
    });

    test('invalidate cache should not throw', () => {
      expect(() => service.invalidateCache(1)).not.toThrow();
    });

    test('should send null condition tree', async () => {
      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getScope(collection, context);

      expect(conditionTree).toBeNull();
    });

    test('should not fetch at each request', async () => {
      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      await service.getScope(collection, context);
      await service.getScope(collection, context);
      await service.getScope(collection, context);

      expect(ForestHttpApi.getPermissions).toHaveBeenCalledTimes(1);
    });

    test('should refetch is the cache is invalidated', async () => {
      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      await service.getScope(collection, context);
      await service.getScope(collection, context);

      service.invalidateCache(1);
      await service.getScope(collection, context);
      await service.getScope(collection, context);

      expect(ForestHttpApi.getPermissions).toHaveBeenCalledTimes(2);
    });

    test('should not throw on allowed actions', async () => {
      const context = createMockContext({ state: { user: { renderingId: 1, id: 1 } } });

      await expect(service.can(context, 'browse:books')).resolves.not.toThrow();
      expect(ForestHttpApi.getPermissions).toHaveBeenCalledTimes(1);
    });

    test('should throw on forbidden actions', async () => {
      const context = createMockContext({ state: { user: { renderingId: 1, id: 1 } } });
      await service.can(context, 'not_allowed');

      expect(context.throw).toHaveBeenCalled();
      expect(ForestHttpApi.getPermissions).toHaveBeenCalledTimes(2);
    });
  });

  describe('with scopes activated', () => {
    test('should work in simple case', async () => {
      getPermissions.mockResolvedValue({
        actions: new Set(),
        actionsByUser: {},
        scopes: {
          books: { conditionTree: new ConditionTreeLeaf('id', Operator.Equal, 43) },
        },
      });

      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getScope(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'equal', value: 43 });
    });

    test('should work with substitutions', async () => {
      getPermissions.mockResolvedValue({
        actions: new Set(),
        actionsByUser: {},
        scopes: {
          books: {
            conditionTree: new ConditionTreeLeaf(
              'id',
              Operator.Equal,
              '$currentUser.tags.something',
            ),
            dynamicScopeValues: { 34: { '$currentUser.tags.something': 'value' } },
          },
        },
      });

      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getScope(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'equal', value: 'value' });
    });

    test('should fallback to jwt when the cache is broken', async () => {
      getPermissions.mockResolvedValue({
        actions: new Set(),
        actionsByUser: {},
        scopes: {
          books: {
            conditionTree: new ConditionTreeLeaf('id', Operator.Equal, '$currentUser.id'),
            dynamicScopeValues: {},
          },
        },
      });

      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getScope(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'equal', value: 34 });
    });

    test('should fallback to jwt when cache broken for tags', async () => {
      getPermissions.mockResolvedValue({
        actions: new Set(),
        actionsByUser: {},
        scopes: {
          books: {
            conditionTree: new ConditionTreeLeaf(
              'id',
              Operator.Equal,
              '$currentUser.tags.something',
            ),
            dynamicScopeValues: {},
          },
        },
      });

      const context = createMockContext({
        state: { user: { renderingId: 1, id: 34, tags: { something: 'tagValue' } } },
      });
      const conditionTree = await service.getScope(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'equal', value: 'tagValue' });
    });
  });
});
