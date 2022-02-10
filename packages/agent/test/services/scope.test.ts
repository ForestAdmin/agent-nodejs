import { ConditionTreeLeaf, Operator } from '@forestadmin/datasource-toolkit';
import { createMockContext } from '@shopify/jest-koa-mocks';
import ScopeService from '../../src/services/scope';
import * as factories from '../__factories__';
import ForestHttpApi from '../../src/utils/forest-http-api';

jest.mock('../../src/utils/forest-http-api', () => ({
  getScopes: jest.fn(),
}));

const getScopes = ForestHttpApi.getScopes as jest.Mock;

describe('Scope', () => {
  const options = factories.forestAdminHttpDriverOptions.build();
  const collection = factories.collection.build({
    name: 'books',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.isPrimaryKey().build(),
      },
    }),
  });

  let service: ScopeService;
  beforeEach(() => {
    service = new ScopeService(options);
    jest.resetAllMocks();
  });

  describe('with no scopes activated', () => {
    beforeEach(() => {
      getScopes.mockResolvedValue({});
    });

    test('invalidate cache should not throw', () => {
      expect(() => service.invalidateCache(1)).not.toThrow();
    });

    test('should send null condition tree', async () => {
      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getConditionTree(collection, context);

      expect(conditionTree).toBeNull();
    });

    test('should not fetch at each request', async () => {
      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      await service.getConditionTree(collection, context);
      await service.getConditionTree(collection, context);
      await service.getConditionTree(collection, context);

      expect(ForestHttpApi.getScopes).toHaveBeenCalledTimes(1);
    });

    test('should refetch is the cache is invalidated', async () => {
      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      await service.getConditionTree(collection, context);
      await service.getConditionTree(collection, context);

      service.invalidateCache(1);
      await service.getConditionTree(collection, context);
      await service.getConditionTree(collection, context);

      expect(ForestHttpApi.getScopes).toHaveBeenCalledTimes(2);
    });
  });

  describe('with scopes activated', () => {
    test('should work in simple case', async () => {
      getScopes.mockResolvedValue({
        books: { conditionTree: new ConditionTreeLeaf('id', Operator.Equal, 43) },
      });

      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getConditionTree(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'equal', value: 43 });
    });

    test('should work with substitutions', async () => {
      getScopes.mockResolvedValue({
        books: {
          conditionTree: new ConditionTreeLeaf('id', Operator.Equal, '$currentUser.tags.something'),
          dynamicScopesValues: {
            34: { '$currentUser.tags.something': 'value' },
          },
        },
      });

      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getConditionTree(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'equal', value: 'value' });
    });

    test('should fallback to jwt when the cache is broken', async () => {
      getScopes.mockResolvedValue({
        books: {
          conditionTree: new ConditionTreeLeaf('id', Operator.Equal, '$currentUser.id'),
          dynamicScopesValues: {},
        },
      });

      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      const conditionTree = await service.getConditionTree(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'equal', value: 34 });
    });

    test('should fallback to jwt when cache broken for tags', async () => {
      getScopes.mockResolvedValue({
        books: {
          conditionTree: new ConditionTreeLeaf('id', Operator.Equal, '$currentUser.tags.something'),
          dynamicScopesValues: {},
        },
      });

      const context = createMockContext({
        state: {
          user: { renderingId: 1, id: 34, tags: [{ key: 'something', value: 'tagValue' }] },
        },
      });
      const conditionTree = await service.getConditionTree(collection, context);

      expect(conditionTree).toEqual({ field: 'id', operator: 'equal', value: 'tagValue' });
    });

    test('should throw if the request cannot be satisfied', async () => {
      getScopes.mockResolvedValue({
        books: {
          conditionTree: new ConditionTreeLeaf('id', Operator.Equal, '$currentUser.doNotExist'),
          dynamicScopesValues: {},
        },
      });

      const context = createMockContext({ state: { user: { renderingId: 1, id: 34 } } });
      await expect(service.getConditionTree(collection, context)).rejects.toThrow(
        "Failed to resolve value for replacement string '$currentUser.doNotExist'",
      );
    });
  });
});
