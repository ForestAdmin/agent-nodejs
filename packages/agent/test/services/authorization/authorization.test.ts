import {
  ChainedSQLQueryError,
  ChartType,
  CollectionActionEvent,
  EmptySQLQueryError,
  NonSelectSQLQueryError,
} from '@forestadmin/forestadmin-client';
import { Context } from 'koa';

import AuthorizationService from '../../../src/services/authorization/authorization';
import { HttpCode } from '../../../src/types';
import ConditionTreeParser from '../../../src/utils/condition-tree-parser';
import * as factories from '../../__factories__';

jest.mock('../../../src/utils/condition-tree-parser', () => ({
  __esModule: true,
  default: {
    fromPlainObject: jest.fn(),
  },
}));

describe('AuthorizationService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe.each([
    { assertion: 'assertCanAdd', event: CollectionActionEvent.Add },
    { assertion: 'assertCanBrowse', event: CollectionActionEvent.Browse },
    { assertion: 'assertCanDelete', event: CollectionActionEvent.Delete },
    { assertion: 'assertCanEdit', event: CollectionActionEvent.Edit },
    { assertion: 'assertCanExport', event: CollectionActionEvent.Export },
    { assertion: 'assertCanRead', event: CollectionActionEvent.Read },
  ])('%s', ({ assertion, event }) => {
    it('should not do anything for authorized users', async () => {
      const forestAdminClient = factories.forestAdminClient.build();
      const authorizationService = new AuthorizationService(forestAdminClient);

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.permissionService.canOnCollection as jest.Mock).mockResolvedValue(true);

      await authorizationService[assertion](context, 'books');

      expect(context.throw).not.toHaveBeenCalled();

      expect(forestAdminClient.permissionService.canOnCollection).toHaveBeenCalledWith({
        userId: 35,
        event,
        collectionName: 'books',
      });
    });

    it('should throw an error when the user is not authorized', async () => {
      const forestAdminClient = factories.forestAdminClient.build();
      const authorizationService = new AuthorizationService(forestAdminClient);

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.permissionService.canOnCollection as jest.Mock).mockResolvedValue(false);

      await authorizationService[assertion](context, 'books');

      expect(context.throw).toHaveBeenCalledWith(HttpCode.Forbidden, 'Forbidden');
    });
  });

  describe('getScope', () => {
    it('should return the scope for the given user', async () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      const user = { id: 666, renderingId: 42 };
      const collection = factories.collection.build({ name: 'books' });
      const context = {
        state: {
          user,
        },
        request: {
          body: { foo: 'bar' },
        },
      } as Context;
      const parsed = Symbol('parsed');

      (forestAdminClient.getScope as jest.Mock).mockResolvedValue({ foo: 'bar' });
      (ConditionTreeParser.fromPlainObject as jest.Mock).mockReturnValue(parsed);

      const scope = await authorizationService.getScope(collection, context);

      expect(scope).toStrictEqual(parsed);

      expect(forestAdminClient.getScope).toHaveBeenCalledWith({
        renderingId: 42,
        userId: 666,
        collectionName: 'books',
      });
      expect(ConditionTreeParser.fromPlainObject).toHaveBeenCalledWith(collection, { foo: 'bar' });
    });
  });

  describe('assertCanExecuteChart', () => {
    it('should check if the user can retrieve the chart and do nothing if OK', async () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        request: { body: { foo: 'bar' } },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.permissionService.canExecuteChart as jest.Mock).mockResolvedValue(true);

      await authorizationService.assertCanExecuteChart(context);

      expect(context.throw).not.toHaveBeenCalled();

      expect(forestAdminClient.permissionService.canExecuteChart).toHaveBeenCalledWith({
        renderingId: 42,
        userId: 35,
        chartRequest: context.request.body,
      });
    });

    it('should throw an error if the user cannot retrieve the chart', async () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        request: {
          body: {
            type: ChartType.Value,
            sourceCollectionName: 'jedi',
            aggregateFieldName: 'strength',
            aggregator: 'Sum',
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.permissionService.canExecuteChart as jest.Mock).mockResolvedValue(false);

      await authorizationService.assertCanExecuteChart(context);

      expect(context.throw).toHaveBeenCalledWith(HttpCode.Forbidden, 'Forbidden');
      expect(forestAdminClient.permissionService.canExecuteChart).toHaveBeenCalledWith({
        renderingId: 42,
        userId: 35,
        chartRequest: {
          type: ChartType.Value,
          sourceCollectionName: 'jedi',
          aggregateFieldName: 'strength',
          aggregator: 'Sum',
        },
      });
    });

    it('should throw an error if the query is empty', async () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        request: {
          body: {
            type: ChartType.Value,
            query: '  ',
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.permissionService.canExecuteChart as jest.Mock).mockRejectedValue(
        new EmptySQLQueryError(),
      );

      await expect(authorizationService.assertCanExecuteChart(context)).rejects.toThrowError(
        new EmptySQLQueryError(),
      );

      expect(forestAdminClient.permissionService.canExecuteChart).toHaveBeenCalledWith({
        renderingId: 42,
        userId: 35,
        chartRequest: {
          type: ChartType.Value,
          query: '  ',
        },
      });
    });

    it('should throw an error if the query is chained', async () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        request: {
          body: {
            type: ChartType.Value,
            query: 'SELECT * FROM jedis; SELECT * FROM siths',
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.permissionService.canExecuteChart as jest.Mock).mockRejectedValue(
        new ChainedSQLQueryError(),
      );

      await expect(authorizationService.assertCanExecuteChart(context)).rejects.toThrowError(
        new ChainedSQLQueryError(),
      );

      expect(forestAdminClient.permissionService.canExecuteChart).toHaveBeenCalledWith({
        renderingId: 42,
        userId: 35,
        chartRequest: {
          type: ChartType.Value,
          query: 'SELECT * FROM jedis; SELECT * FROM siths',
        },
      });
    });

    it('should throw an error if the query is an Update', async () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        request: {
          body: {
            type: ChartType.Value,
            query: 'UPDATE jedis SET padawan_id = ?',
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.permissionService.canExecuteChart as jest.Mock).mockRejectedValue(
        new NonSelectSQLQueryError(),
      );

      await expect(authorizationService.assertCanExecuteChart(context)).rejects.toThrowError(
        new NonSelectSQLQueryError(),
      );

      expect(forestAdminClient.permissionService.canExecuteChart).toHaveBeenCalledWith({
        renderingId: 42,
        userId: 35,
        chartRequest: {
          type: ChartType.Value,
          query: 'UPDATE jedis SET padawan_id = ?',
        },
      });
    });

    it('should rethrow other errors', async () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        request: {
          body: {
            type: ChartType.Value,
            query: 'UPDATE jedis SET padawan_id = ?',
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.permissionService.canExecuteChart as jest.Mock).mockRejectedValue(
        new Error('unknown'),
      );

      await expect(authorizationService.assertCanExecuteChart(context)).rejects.toThrowError(
        'unknown',
      );
    });
  });

  describe('invalidateScopeCache', () => {
    it('should invalidate the scope cache', () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      authorizationService.invalidateScopeCache(42);

      expect(forestAdminClient.markScopesAsUpdated).toHaveBeenCalledWith(42);
    });
  });
});
