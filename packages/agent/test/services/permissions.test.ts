import { createMockContext } from '@shopify/jest-koa-mocks';
import hashObject from 'object-hash';

import * as factories from '../__factories__';
import ForestHttpApi from '../../src/utils/forest-http-api';
import PermissionService from '../../src/services/permissions';

jest.mock('../../src/utils/forest-http-api', () => ({
  getPermissions: jest.fn(),
}));

const getPermissions = ForestHttpApi.getPermissions as jest.Mock;

describe('Permissions', () => {
  const options = factories.forestAdminHttpDriverOptions.build();

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

    test('should throw on forbidden chart using permissionLevel (for user)', async () => {
      const context = createMockContext({
        state: { user: { renderingId: 1, id: 1, permissionLevel: 'user' } },
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
    test('should allow chart using permissionLevel (for admin)', async () => {
      const context = createMockContext({
        state: { user: { renderingId: 1, id: 1, permissionLevel: 'admin' } },
        requestBody: {
          type: 'Pie',
          aggregate: 'Count',
          collection: 'books',
          group_by_field: 'title',
        },
      });

      await expect(service.canChart(context)).resolves.not.toThrow();

      expect(ForestHttpApi.getPermissions).toHaveBeenCalledTimes(0);
    });
  });
});
