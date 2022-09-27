import { Context } from 'koa';

import * as factories from '../../__factories__';

import { CollectionActionEvent } from '../../../src/services/authorization/internal/types';
import { CustomActionEvent } from '../../../src/services/authorization';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../../../src/services/authorization/internal/generate-action-identifier';
import AuthorizationService from '../../../src/services/authorization/authorization';

jest.mock('../../../src/services/authorization/internal/generate-action-identifier', () => ({
  generateCollectionActionIdentifier: jest.fn(),
  generateCustomActionIdentifier: jest.fn(),
}));

describe('AuthorizationService', () => {
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

      (generateCollectionActionIdentifier as jest.Mock).mockReturnValue(
        'collection:books:tested-right',
      );
      (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

      await authorizationService[assertion](context, 'books');

      expect(context.throw).not.toHaveBeenCalled();

      expect(actionPermissionService.can).toHaveBeenCalledWith({
        userId: '35',
        renderingId: '42',
        actionName: 'collection:books:tested-right',
      });
      expect(generateCollectionActionIdentifier).toHaveBeenCalledWith(right, 'books');
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

      (generateCollectionActionIdentifier as jest.Mock).mockReturnValue(
        'collection:books:tested-right',
      );
      (actionPermissionService.can as jest.Mock).mockResolvedValue(false);

      await authorizationService[assertion](context, 'books');

      expect(context.throw).toHaveBeenCalledWith(403, 'Forbidden');

      expect(actionPermissionService.can).toHaveBeenCalledWith({
        userId: '35',
        renderingId: '42',
        actionName: 'collection:books:tested-right',
      });
      expect(generateCollectionActionIdentifier).toHaveBeenCalledWith(right, 'books');
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
