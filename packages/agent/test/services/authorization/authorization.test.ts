import {
  ChainedSQLQueryError,
  ChartType,
  CollectionActionEvent,
  EmptySQLQueryError,
  NonSelectSQLQueryError,
} from '@forestadmin/forestadmin-client';
import { Collection } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import * as factories from '../../__factories__';

import { HttpCode } from '../../../src/types';

import AuthorizationService from '../../../src/services/authorization/authorization';
import ConditionTreeParser from '../../../src/utils/condition-tree-parser';

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

  describe('assertCanTriggerCustomAction', () => {
    it('should do nothing if the user can trigger a custom action', async () => {
      const context = { state: { user: { id: 42 } } } as Context;

      const forestAdminClient = factories.forestAdminClient.build();

      (forestAdminClient.permissionService.canTriggerCustomAction as jest.Mock).mockResolvedValue(
        true,
      );

      const authorization = new AuthorizationService(forestAdminClient);

      await expect(
        authorization.assertCanTriggerCustomAction({
          context,
          customActionName: 'do-something',
          collectionName: 'actors',
        }),
      ).resolves.toBe(undefined);

      expect(forestAdminClient.permissionService.canTriggerCustomAction).toHaveBeenCalledWith({
        userId: 42,
        customActionName: 'do-something',
        collectionName: 'actors',
      });
    });

    it('should throw an error if the user cannot trigger', async () => {
      const context = {
        state: { user: { id: 42 } },
        throw: jest.fn(),
      } as unknown as Context;

      const forestAdminClient = factories.forestAdminClient.build();

      (forestAdminClient.permissionService.canTriggerCustomAction as jest.Mock).mockResolvedValue(
        false,
      );

      const authorization = new AuthorizationService(forestAdminClient);

      await authorization.assertCanTriggerCustomAction({
        context,
        collectionName: 'actors',
        customActionName: 'do-something',
      });

      expect(context.throw).toHaveBeenCalledWith(HttpCode.Forbidden, 'Forbidden');
    });
  });

  describe('assertCanApproveCustomAction', () => {
    it('should do nothing if the user can approve a custom action', async () => {
      const context = { state: { user: { id: 42 } } } as Context;

      const forestAdminClient = factories.forestAdminClient.build();

      (forestAdminClient.permissionService.canApproveCustomAction as jest.Mock).mockResolvedValue(
        true,
      );

      const authorization = new AuthorizationService(forestAdminClient);

      await expect(
        authorization.assertCanApproveCustomAction({
          context,
          customActionName: 'do-something',
          collectionName: 'actors',
          requesterId: 30,
        }),
      ).resolves.toBe(undefined);

      expect(forestAdminClient.permissionService.canApproveCustomAction).toHaveBeenCalledWith({
        userId: 42,
        customActionName: 'do-something',
        collectionName: 'actors',
        requesterId: 30,
      });
    });

    it('should throw an error if the user cannot approve', async () => {
      const context = {
        state: { user: { id: 42 } },
        throw: jest.fn(),
      } as unknown as Context;

      const forestAdminClient = factories.forestAdminClient.build();

      (forestAdminClient.permissionService.canApproveCustomAction as jest.Mock).mockResolvedValue(
        false,
      );

      const authorization = new AuthorizationService(forestAdminClient);

      await authorization.assertCanApproveCustomAction({
        context,
        collectionName: 'actors',
        customActionName: 'do-something',
        requesterId: 30,
      });

      expect(context.throw).toHaveBeenCalledWith(HttpCode.Forbidden, 'Forbidden');
    });
  });

  describe('assertCanRequestCustomActionParameters', () => {
    it('should not do anything if the user has the right to execute action hooks', async () => {
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

      (
        forestAdminClient.permissionService.canRequestCustomActionParameters as jest.Mock
      ).mockResolvedValue(true);

      await authorizationService.assertCanRequestCustomActionParameters(
        context,
        'custom-action',
        'books',
      );

      expect(context.throw).not.toHaveBeenCalled();

      expect(
        forestAdminClient.permissionService.canRequestCustomActionParameters,
      ).toHaveBeenCalledWith({
        userId: 35,
        customActionName: 'custom-action',
        collectionName: 'books',
      });
    });

    it('should throw an error if the user does not have the right', async () => {
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

      (
        forestAdminClient.permissionService.canRequestCustomActionParameters as jest.Mock
      ).mockResolvedValue(false);

      await authorizationService.assertCanRequestCustomActionParameters(
        context,
        'custom-action',
        'books',
      );

      expect(context.throw).toHaveBeenCalledWith(HttpCode.Forbidden, 'Forbidden');
    });
  });

  describe('getScope', () => {
    it('should return the scope for the given user', async () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      const user = { id: 666, renderingId: 42 };
      const collection = { name: 'books' } as Collection;
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
  });

  describe('invalidateScopeCache', () => {
    it('should invalidate the scope cache', () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      authorizationService.invalidateScopeCache(42);

      expect(forestAdminClient.markScopesAsUpdated).toHaveBeenCalledWith(42);
    });
  });

  describe('verifySignedActionParameters', () => {
    it('should return the result from the client', () => {
      const forestAdminClient = factories.forestAdminClient.build();

      const authorizationService = new AuthorizationService(forestAdminClient);

      const signed = { foo: 'bar' };

      (forestAdminClient.verifySignedActionParameters as jest.Mock).mockReturnValue(signed);

      const result = authorizationService.verifySignedActionParameters('signed');

      expect(result).toBe(signed);
      expect(forestAdminClient.verifySignedActionParameters).toHaveBeenCalledWith('signed');
    });
  });
});
