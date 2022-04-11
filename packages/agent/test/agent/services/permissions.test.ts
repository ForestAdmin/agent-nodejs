import { ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import hashObject from 'object-hash';

import * as factories from '../__factories__';
import ForestHttpApi from '../../../src/agent/utils/forest-http-api';
import PermissionService from '../../../src/agent/services/permissions';

jest.mock('../../../src/agent/utils/forest-http-api', () => ({
  getPermissions: jest.fn(),
}));

const getPermissions = ForestHttpApi.getPermissions as jest.Mock;

describe('Permissions', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
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
      const chart = {
        type: 'Pie',
        aggregate: 'Count',
        collection: 'books',
        group_by_field: 'author',
      };

      getPermissions.mockResolvedValue({
        actions: new Set(['read:books', `chart:${hashObject(chart, { respectType: false })}`]),
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

    test('should not throw on allowed actions (allowed for all)', async () => {
      const context = createMockContext({ state: { user: { renderingId: 1, id: 1 } } });

      await expect(service.can(context, 'read:books')).resolves.not.toThrow();

      expect(ForestHttpApi.getPermissions).toHaveBeenCalledTimes(1);
    });

    test('should not throw on allowed actions (allowed by user)', async () => {
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

    test('should not throw on allowed chart (using relation)', async () => {
      const context = createMockContext({
        state: { user: { renderingId: 1, id: 1 } },
        requestBody: {
          type: 'Pie',
          aggregate: 'Count',
          collection: 'books',
          group_by_field: 'author:firstName',
        },
      });

      await expect(service.canChart(context)).resolves.not.toThrow();

      expect(ForestHttpApi.getPermissions).toHaveBeenCalledTimes(1);
    });

    test('should throw on forbidden chart (using relation)', async () => {
      const context = createMockContext({
        state: { user: { renderingId: 1, id: 1 } },
        requestBody: {
          type: 'Pie',
          aggregate: 'Count',
          collection: 'books',
          group_by_field: 'title',
        },
      });

      await service.canChart(context);
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
          books: { conditionTree: new ConditionTreeLeaf('id', 'Equal', 43) },
        },
      });

      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getScope(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'Equal', value: 43 });
    });

    test('should work with substitutions', async () => {
      getPermissions.mockResolvedValue({
        actions: new Set(),
        actionsByUser: {},
        scopes: {
          books: {
            conditionTree: new ConditionTreeLeaf('id', 'Equal', '$currentUser.tags.something'),
            dynamicScopeValues: { 34: { '$currentUser.tags.something': 'value' } },
          },
        },
      });

      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getScope(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'Equal', value: 'value' });
    });

    test('should fallback to jwt when the cache is broken', async () => {
      getPermissions.mockResolvedValue({
        actions: new Set(),
        actionsByUser: {},
        scopes: {
          books: {
            conditionTree: new ConditionTreeLeaf('id', 'Equal', '$currentUser.id'),
            dynamicScopeValues: {},
          },
        },
      });

      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getScope(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'Equal', value: 34 });
    });

    test('should fallback to jwt when cache broken for tags', async () => {
      getPermissions.mockResolvedValue({
        actions: new Set(),
        actionsByUser: {},
        scopes: {
          books: {
            conditionTree: new ConditionTreeLeaf('id', 'Equal', '$currentUser.tags.something'),
            dynamicScopeValues: {},
          },
        },
      });

      const context = createMockContext({
        state: { user: { renderingId: 1, id: 34, tags: { something: 'tagValue' } } },
      });
      const conditionTree = await service.getScope(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'Equal', value: 'tagValue' });
    });
  });
});
