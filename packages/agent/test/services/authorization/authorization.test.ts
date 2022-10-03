import { Collection, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';

import * as factories from '../../__factories__';

import { CollectionActionEvent } from '../../../src/services/authorization/internal/types';
import { CustomActionEvent } from '../../../src/services/authorization';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../../../src/services/authorization/internal/generate-action-identifier';
import AuthorizationService from '../../../src/services/authorization/authorization';
import verifyAndExtractApproval from '../../../src/services/authorization/internal/verify-approval';

jest.mock('../../../src/services/authorization/internal/generate-action-identifier', () => ({
  generateCollectionActionIdentifier: jest.fn(),
  generateCustomActionIdentifier: jest.fn(),
}));

jest.mock('../../../src/services/authorization/internal/verify-approval', () => jest.fn());

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

  describe.each([
    { assertion: 'assertCanAdd', right: CollectionActionEvent.Add },
    { assertion: 'assertCanBrowse', right: CollectionActionEvent.Browse },
    { assertion: 'assertCanDelete', right: CollectionActionEvent.Delete },
    { assertion: 'assertCanEdit', right: CollectionActionEvent.Edit },
    { assertion: 'assertCanExport', right: CollectionActionEvent.Export },
    { assertion: 'assertCanRead', right: CollectionActionEvent.Read },
  ])('%s', ({ assertion, right }) => {
    it('should not do anything for authorized users', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
        { envSecret: 'envSecret' },
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

      (generateCollectionActionIdentifier as jest.Mock).mockReturnValue(
        'collection:books:tested-right',
      );
      (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

      await authorizationService[assertion](context, 'books');

      expect(context.throw).not.toHaveBeenCalled();

      expect(actionPermissionService.can).toHaveBeenCalledWith(
        '35',
        'collection:books:tested-right',
      );
      expect(generateCollectionActionIdentifier).toHaveBeenCalledWith(right, 'books');
    });

    it('should throw an error when the user is not authorized', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
        { envSecret: 'envSecret' },
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

      (generateCollectionActionIdentifier as jest.Mock).mockReturnValue(
        'collection:books:tested-right',
      );
      (actionPermissionService.can as jest.Mock).mockResolvedValue(false);

      await authorizationService[assertion](context, 'books');

      expect(context.throw).toHaveBeenCalledWith(403, 'Forbidden');

      expect(actionPermissionService.can).toHaveBeenCalledWith(
        '35',
        'collection:books:tested-right',
      );
      expect(generateCollectionActionIdentifier).toHaveBeenCalledWith(right, 'books');
    });
  });

  describe('assertCanExecuteCustomAction', () => {
    describe('Trigger', () => {
      it('should not do anything if the user is authorized', async () => {
        const actionPermissionService = factories.actionPermission.mockAllMethods().build();
        const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
        const authorizationService = new AuthorizationService(
          actionPermissionService,
          renderingPermissionService,
          { envSecret: 'envSecret' },
        );

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

        (generateCustomActionIdentifier as jest.Mock).mockReturnValue(
          'custom-action:books:trigger',
        );
        (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

        await authorizationService.assertCanExecuteCustomAction(context, 'custom-action', 'books');

        expect(context.throw).not.toHaveBeenCalled();

        expect(generateCustomActionIdentifier).toHaveBeenCalledTimes(1);
        expect(generateCustomActionIdentifier).toHaveBeenCalledWith(
          CustomActionEvent.Trigger,
          'custom-action',
          'books',
        );

        expect(actionPermissionService.can).toHaveBeenCalledWith(
          '35',
          'custom-action:books:trigger',
        );
      });
    });

    describe('Approve', () => {
      it('should not do anything if the user is authorized', async () => {
        const actionPermissionService = factories.actionPermission.mockAllMethods().build();
        const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
        const authorizationService = new AuthorizationService(
          actionPermissionService,
          renderingPermissionService,
          { envSecret: 'envSecret' },
        );

        const context = {
          state: {
            user: {
              id: 35,
              renderingId: 42,
            },
            isCustomActionApprovalRequest: true,
          },
          request: {
            body: {
              data: {
                attributes: { requester_id: 999 },
              },
            },
          },
          throw: jest.fn(),
        } as unknown as Context;

        (generateCustomActionIdentifier as jest.Mock).mockReturnValue(
          'custom-action:books:approve',
        );
        (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

        await authorizationService.assertCanExecuteCustomAction(context, 'custom-action', 'books');

        expect(context.throw).not.toHaveBeenCalled();

        expect(generateCustomActionIdentifier).toHaveBeenCalledTimes(1);
        expect(generateCustomActionIdentifier).toHaveBeenCalledWith(
          CustomActionEvent.Approve,
          'custom-action',
          'books',
        );

        expect(actionPermissionService.can).toHaveBeenCalledWith(
          '35',
          'custom-action:books:approve',
        );
      });
    });

    describe('SelfApprove', () => {
      it('should not do anything if the user is authorized', async () => {
        const actionPermissionService = factories.actionPermission.mockAllMethods().build();
        const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
        const authorizationService = new AuthorizationService(
          actionPermissionService,
          renderingPermissionService,
          { envSecret: 'envSecret' },
        );

        const context = {
          state: {
            user: {
              id: 35,
              renderingId: 42,
            },
            isCustomActionApprovalRequest: true,
          },
          request: {
            body: {
              data: {
                attributes: { requester_id: 35 },
              },
            },
          },
          throw: jest.fn(),
        } as unknown as Context;

        (generateCustomActionIdentifier as jest.Mock).mockReturnValue(
          'custom-action:books:self-approve',
        );
        (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

        await authorizationService.assertCanExecuteCustomAction(context, 'custom-action', 'books');

        expect(context.throw).not.toHaveBeenCalled();

        expect(generateCustomActionIdentifier).toHaveBeenCalledTimes(1);
        expect(generateCustomActionIdentifier).toHaveBeenCalledWith(
          CustomActionEvent.SelfApprove,
          'custom-action',
          'books',
        );

        expect(actionPermissionService.can).toHaveBeenCalledWith(
          '35',
          'custom-action:books:self-approve',
        );
      });
    });

    it('should throw an error if the user is not authorized', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
        { envSecret: 'envSecret' },
      );

      const context = {
        state: {
          user: {
            id: 35,
            renderingId: 42,
          },
        },
        request: {
          body: {
            data: {},
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

  describe('getApprovalRequestData', () => {
    it('should return null when not signed_approval_request request attributes', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
        { envSecret: 'envSecret' },
      );

      const context = {
        request: {
          body: {
            data: {},
          },
        },
        throw: jest.fn(),
      } as unknown as Context;

      const verifyAndExtractApprovalMock = verifyAndExtractApproval as jest.Mock;

      await authorizationService.getApprovalRequestData(context);

      expect(verifyAndExtractApprovalMock).not.toHaveBeenCalled();
    });

    it(
      'should return the approval data when signed_approval_request' +
        ' is in the request attributes',
      async () => {
        const actionPermissionService = factories.actionPermission.mockAllMethods().build();
        const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
        const authorizationService = new AuthorizationService(
          actionPermissionService,
          renderingPermissionService,
          { envSecret: 'envSecret' },
        );

        const context = {
          request: {
            body: {
              data: {
                attributes: { signed_approval_request: 'signedApprovalRequest' },
              },
            },
          },
          throw: jest.fn(),
        } as unknown as Context;

        const verifyAndExtractApprovalMock = (
          verifyAndExtractApproval as jest.Mock
        ).mockReturnValue('verifyAndExtractApprovalData');

        const result = await authorizationService.getApprovalRequestData(context);

        expect(result).toStrictEqual('verifyAndExtractApprovalData');
        expect(verifyAndExtractApprovalMock).toHaveBeenCalledWith(
          'signedApprovalRequest',
          'envSecret',
        );
      },
    );
  });

  describe('getScope', () => {
    it('should return the scope for the given user', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(
        actionPermissionService,
        renderingPermissionService,
        { envSecret: 'envSecret' },
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
        { envSecret: 'envSecret' },
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
        { envSecret: 'envSecret' },
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
        { envSecret: 'envSecret' },
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
        { envSecret: 'envSecret' },
      );

      authorizationService.invalidateScopeCache(42);

      expect(renderingPermissionService.invalidateCache).toHaveBeenCalledWith(42);
    });
  });
});
