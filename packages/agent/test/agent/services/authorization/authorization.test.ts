import { Collection, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import * as factories from '../../__factories__';

import {
  CollectionActionEvent,
  CustomActionEvent,
} from '../../../../src/agent/services/authorization';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../../../../src/agent/services/authorization/internal/generate-action-identifier';
import AuthorizationService from '../../../../src/agent/services/authorization/authorization';

jest.mock(
  '../../../../src/agent/services/authorization/internal/generate-action-identifier',
  () => ({
    generateCollectionActionIdentifier: jest.fn(),
    generateCustomActionIdentifier: jest.fn(),
  }),
);

jest.mock('@forestadmin/datasource-toolkit', () => ({
  __esModule: true,
  ConditionTreeFactory: {
    fromPlainObject: jest.fn(),
  },
}));

describe('AuthorizationService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('assertCanOnCollection', () => {
    it('should not do anything for authorized users', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
      );

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (generateCollectionActionIdentifier as jest.Mock).mockReturnValue('collection:books:add');
      (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

      await authorizationService.assertCanOnCollection(context, CollectionActionEvent.Add, 'books');

      expect(context.throw).not.toHaveBeenCalled();

      expect(actionPermissionService.can).toHaveBeenCalledWith({
        userId: '35',
        renderingId: '42',
        actionName: 'collection:books:add',
      });
      expect(generateCollectionActionIdentifier).toHaveBeenCalledWith(
        CollectionActionEvent.Add,
        'books',
      );
    });

    it('should throw an error when the user is not authorized', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
      );

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (generateCollectionActionIdentifier as jest.Mock).mockReturnValue('collection:books:add');
      (actionPermissionService.can as jest.Mock).mockResolvedValue(false);

      await authorizationService.assertCanOnCollection(context, CollectionActionEvent.Add, 'books');

      expect(context.throw).toHaveBeenCalledWith(403, 'Forbidden');

      expect(actionPermissionService.can).toHaveBeenCalledWith({
        userId: '35',
        renderingId: '42',
        actionName: 'collection:books:add',
      });
      expect(generateCollectionActionIdentifier).toHaveBeenCalledWith(
        CollectionActionEvent.Add,
        'books',
      );
    });
  });

  describe('assertCanExecuteCustomAction', () => {
    it('should not do anything if the user is authorized', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
      );

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (generateCustomActionIdentifier as jest.Mock).mockReturnValue('custom:books:approve');
      (actionPermissionService.canOneOf as jest.Mock).mockResolvedValue(true);

      await authorizationService.assertCanExecuteCustomAction(context, 'custom-action', 'books');

      expect(context.throw).not.toHaveBeenCalled();

      expect(actionPermissionService.canOneOf).toHaveBeenCalledWith({
        userId: '35',
        renderingId: '42',
        actionNames: ['custom:books:approve', 'custom:books:approve', 'custom:books:approve'],
      });

      expect(generateCustomActionIdentifier).toHaveBeenCalledTimes(3);
      expect(generateCustomActionIdentifier).toHaveBeenCalledWith(
        CustomActionEvent.Trigger,
        'custom-action',
        'books',
      );
      expect(generateCustomActionIdentifier).toHaveBeenCalledWith(
        CustomActionEvent.Approve,
        'custom-action',
        'books',
      );
      expect(generateCustomActionIdentifier).toHaveBeenCalledWith(
        CustomActionEvent.SelfApprove,
        'custom-action',
        'books',
      );
    });

    it('should throw an error if the user is not authorized', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
      );

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (generateCustomActionIdentifier as jest.Mock).mockReturnValue('custom:books:approve');
      (actionPermissionService.canOneOf as jest.Mock).mockResolvedValue(false);

      await authorizationService.assertCanExecuteCustomAction(context, 'custom-action', 'books');

      expect(context.throw).toHaveBeenCalledWith(403, 'Forbidden');
    });
  });

  describe('getScope', () => {
    it('should return the scope for the given user', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
      );

      const getScopeMock = renderingPermissionService.getScope as jest.Mock;
      getScopeMock.mockResolvedValueOnce({
        field: 'title',
        value: 'foo',
        operator: 'Equal',
      });

      const fromPlainObjectMock = ConditionTreeFactory.fromPlainObject as jest.Mock;
      fromPlainObjectMock.mockReturnValue({ foo: 'bar' });

      const user = { id: 42, renderingId: '666' };
      const context = {
        state: {
          user,
        },
      } as Context;

      const collection = { name: 'books' } as Collection;

      const scope = await authorizationService.getScope(collection, context);

      expect(scope).toEqual({ foo: 'bar' });
      expect(ConditionTreeFactory.fromPlainObject).toHaveBeenCalledWith({
        field: 'title',
        value: 'foo',
        operator: 'Equal',
      });
      expect(renderingPermissionService.getScope).toHaveBeenCalledWith({
        renderingId: '666',
        collectionName: 'books',
        user,
      });
    });

    it('should return null when there is no scope', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
      );

      const getScopeMock = renderingPermissionService.getScope as jest.Mock;
      getScopeMock.mockResolvedValueOnce(null);

      const fromPlainObjectMock = ConditionTreeFactory.fromPlainObject as jest.Mock;
      fromPlainObjectMock.mockReturnValue({ foo: 'bar' });

      const user = { id: 42, renderingId: 666 };
      const context = {
        state: {
          user,
        },
      } as Context;

      const collection = { name: 'books' } as Collection;

      const scope = await authorizationService.getScope(collection, context);

      expect(scope).toBe(null);
      expect(ConditionTreeFactory.fromPlainObject).not.toHaveBeenCalled();
    });
  });

  describe('assertCanRetrieveChart', () => {
    it('should check if the user can retrieve the chart and do nothing if OK', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
      );

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        request: {
          body: { foo: 'bar' },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (renderingPermissionService.canRetrieveChart as jest.Mock).mockResolvedValue(true);

      await authorizationService.assertCanRetrieveChart(context);

      expect(renderingPermissionService.canRetrieveChart).toHaveBeenCalledWith({
        userId: 35,
        renderingId: 42,
        chartRequest: context.request.body,
      });
      expect(context.throw).not.toHaveBeenCalled();
    });

    it('should throw an error if the user cannot retrieve the chart', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
      );

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        request: {
          body: { foo: 'bar' },
        },
        throw: jest.fn(),
      } as unknown as Context;

      (renderingPermissionService.canRetrieveChart as jest.Mock).mockResolvedValue(false);

      await authorizationService.assertCanRetrieveChart(context);

      expect(context.throw).toHaveBeenCalledWith(403, 'Forbidden');
    });
  });

  describe('invalidateScopeCache', () => {
    it('should invalidate the scope cache', () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
      );

      authorizationService.invalidateScopeCache(42);

      expect(renderingPermissionService.invalidateCache).toHaveBeenCalledWith(42);
    });
  });
});
