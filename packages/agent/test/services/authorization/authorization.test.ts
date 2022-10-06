import { Collection, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { CollectionActionEvent } from '@forestadmin/forestadmin-client';
import { Context } from 'koa';

import * as factories from '../../__factories__';

import { HttpCode } from '../../../src/types';

import AuthorizationService from '../../../src/services/authorization/authorization';

jest.mock('@forestadmin/datasource-toolkit', () => ({
  ConditionTreeFactory: {
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

      (forestAdminClient.canOnCollection as jest.Mock).mockResolvedValue(true);

      await authorizationService[assertion](context, 'books');

      expect(context.throw).not.toHaveBeenCalled();

      expect(forestAdminClient.canOnCollection).toHaveBeenCalledWith({
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

      (forestAdminClient.canOnCollection as jest.Mock).mockResolvedValue(false);

      await authorizationService[assertion](context, 'books');

      expect(context.throw).toHaveBeenCalledWith(HttpCode.Forbidden, 'Forbidden');
    });
  });

  describe('assertCanExecuteCustomActionAndReturnRequestBody', () => {
    it('should return the body if the user is authorized', async () => {
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
            data: {
              attributes: {},
            },
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.canExecuteCustomAction as jest.Mock).mockResolvedValue({ foo: 'bar' });

      await authorizationService.assertCanExecuteCustomActionAndReturnRequestBody(
        context,
        'custom-action',
        'books',
      );

      expect(context.throw).not.toHaveBeenCalled();

      expect(forestAdminClient.canExecuteCustomAction).toHaveBeenCalledWith({
        userId: 35,
        customActionName: 'custom-action',
        collectionName: 'books',
        body: context.request.body,
      });
    });

    it('should throw an error if the user is not authorized', async () => {
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
            data: {
              attributes: {},
            },
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.canExecuteCustomAction as jest.Mock).mockResolvedValue(false);

      await authorizationService.assertCanExecuteCustomActionAndReturnRequestBody(
        context,
        'custom-action',
        'books',
      );

      expect(context.throw).toHaveBeenCalledWith(HttpCode.Forbidden, 'Forbidden');
    });
  });

  describe('assertCanExecuteCustomActionHook', () => {
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

      (forestAdminClient.canExecuteCustomActionHook as jest.Mock).mockResolvedValue(true);

      await authorizationService.assertCanExecuteCustomActionHook(
        context,
        'custom-action',
        'books',
      );

      expect(context.throw).not.toHaveBeenCalled();

      expect(forestAdminClient.canExecuteCustomActionHook).toHaveBeenCalledWith({
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

      (forestAdminClient.canExecuteCustomActionHook as jest.Mock).mockResolvedValue(false);

      await authorizationService.assertCanExecuteCustomActionHook(
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
      (ConditionTreeFactory.fromPlainObject as jest.Mock).mockReturnValue(parsed);

      const scope = await authorizationService.getScope(collection, context);

      expect(scope).toStrictEqual(parsed);

      expect(forestAdminClient.getScope).toHaveBeenCalledWith({
        renderingId: 42,
        user,
        collectionName: 'books',
      });
      expect(ConditionTreeFactory.fromPlainObject).toHaveBeenCalledWith({ foo: 'bar' });
    });
  });

  describe('assertCanRetrieveChart', () => {
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

      (forestAdminClient.canRetrieveChart as jest.Mock).mockResolvedValue(true);

      await authorizationService.assertCanRetrieveChart(context);

      expect(context.throw).not.toHaveBeenCalled();

      expect(forestAdminClient.canRetrieveChart).toHaveBeenCalledWith({
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
        request: { body: { foo: 'bar' } },
        throw: jest.fn(),
      } as unknown as Context;

      (forestAdminClient.canRetrieveChart as jest.Mock).mockResolvedValue(false);

      await authorizationService.assertCanRetrieveChart(context);

      expect(context.throw).toHaveBeenCalledWith(HttpCode.Forbidden, 'Forbidden');
      expect(forestAdminClient.canRetrieveChart).toHaveBeenCalledWith({
        renderingId: 42,
        userId: 35,
        chartRequest: { foo: 'bar' },
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
});
