import { Context } from 'koa';

import * as factories from '../__factories__';

import { CollectionActionEvent, CustomActionEvent } from '../../../src/agent/utils/types';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../../../src/agent/utils/generate-action-identifier';
import AuthorizationService from '../../../src/agent/services/authorization';

jest.mock('../../../src/agent/utils/generate-action-identifier', () => ({
  generateCollectionActionIdentifier: jest.fn(),
  generateCustomActionIdentifier: jest.fn(),
}));

describe('AuthorizationService', () => {
  describe('assertCanOnCollection', () => {
    it('should not do anything for authorized users', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const authorizationService = new AuthorizationService(actionPermissionService);

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
      const authorizationService = new AuthorizationService(actionPermissionService);

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
      const authorizationService = new AuthorizationService(actionPermissionService);

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
      const authorizationService = new AuthorizationService(actionPermissionService);

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
});
