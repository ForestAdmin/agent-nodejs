import * as factories from './__factories__';
import {
  CollectionActionEvent,
  CustomActionEvent,
  SmartActionApprovalRequestBody,
} from '../src/permissions/types';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '../src/permissions/generate-action-identifier';
import ForestAdminClient from '../src/forest-admin-client';
import verifyAndExtractApproval from '../src/permissions/verify-approval';

jest.mock('../src/permissions/generate-action-identifier', () => ({
  generateCollectionActionIdentifier: jest.fn(),
  generateCustomActionIdentifier: jest.fn(),
}));

jest.mock('../src/permissions/verify-approval', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const generateCollectionActionIdentifierMock = generateCollectionActionIdentifier as jest.Mock;
const generateCustomActionIdentifierMock = generateCustomActionIdentifier as jest.Mock;
const verifyAndExtractApprovalMock = verifyAndExtractApproval as jest.Mock;

describe('ForestAdminClient', () => {
  describe('canOnCollection', () => {
    it('should return the result of actionPermissionService and pass the right event', async () => {
      const userId = 1;
      const collectionName = 'collectionName';
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        actionPermissionService,
        factories.renderingPermission.build(),
      );

      generateCollectionActionIdentifierMock.mockReturnValue('identifier');
      (actionPermissionService.can as jest.Mock).mockResolvedValue(true);

      const result = await forestAdminClient.canOnCollection({
        userId,
        event: CollectionActionEvent.Add,
        collectionName,
      });

      expect(actionPermissionService.can).toHaveBeenCalledWith(`${userId}`, 'identifier');

      expect(generateCollectionActionIdentifierMock).toHaveBeenCalledWith(
        CollectionActionEvent.Add,
        collectionName,
      );
      expect(result).toBe(true);
    });
  });

  describe('canExecuteCustomAction', () => {
    describe('when the request is an approval request', () => {
      describe.each([
        { isSelfApproval: true, expectedEvent: CustomActionEvent.SelfApprove },
        { isSelfApproval: false, expectedEvent: CustomActionEvent.Approve },
      ])('when the approval is a $expectedEvent', ({ isSelfApproval, expectedEvent }) => {
        it('should return the signed body when the user as the right', async () => {
          const body = {
            data: {
              attributes: {
                requester_id: 666,
                signed_approval_request: 'signedApprovalRequest',
              },
            },
          } as SmartActionApprovalRequestBody;

          const signedRequest = {
            data: {
              attributes: {
                requester_id: isSelfApproval ? 42 : 420,
                foo: 'bar',
              },
            },
          };

          const actionPermissionService = factories.actionPermission.mockAllMethods().build();
          const forestAdminClient = new ForestAdminClient(
            factories.forestAdminClientOptions.build(),
            actionPermissionService,
            factories.renderingPermission.build(),
          );

          (actionPermissionService.can as jest.Mock).mockResolvedValue(true);
          generateCustomActionIdentifierMock.mockReturnValue('identifier');
          verifyAndExtractApprovalMock.mockReturnValue(signedRequest);

          const result = await forestAdminClient.canExecuteCustomAction({
            userId: 42,
            customActionName: 'doSomething',
            collectionName: 'jedis',
            body,
          });

          expect(actionPermissionService.can).toHaveBeenCalledWith('42', 'identifier');
          expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
            expectedEvent,
            'doSomething',
            'jedis',
          );
          expect(result).toBe(signedRequest);
        });

        it('should return false if the user does not have the right', async () => {
          const body = {
            data: {
              attributes: {
                requester_id: 666,
                signed_approval_request: 'signedApprovalRequest',
              },
            },
          } as SmartActionApprovalRequestBody;

          const signedRequest = {
            data: {
              attributes: {
                requester_id: isSelfApproval ? 42 : 420,
                foo: 'bar',
              },
            },
          };

          const actionPermissionService = factories.actionPermission.mockAllMethods().build();
          const forestAdminClient = new ForestAdminClient(
            factories.forestAdminClientOptions.build(),
            actionPermissionService,
            factories.renderingPermission.build(),
          );

          (actionPermissionService.can as jest.Mock).mockResolvedValue(false);
          generateCustomActionIdentifierMock.mockReturnValue('identifier');
          verifyAndExtractApprovalMock.mockReturnValue(signedRequest);

          const result = await forestAdminClient.canExecuteCustomAction({
            userId: 42,
            customActionName: 'doSomething',
            collectionName: 'jedis',
            body,
          });

          expect(result).toBe(false);
        });
      });
    });

    describe('when the request is a trigger request', () => {
      describe.each([
        { isSelfApproval: true, expectedEvent: CustomActionEvent.SelfApprove },
        { isSelfApproval: false, expectedEvent: CustomActionEvent.Approve },
      ])('when the approval is a $expectedEvent', ({ isSelfApproval, expectedEvent }) => {
        it('should return the body when the user as the right', async () => {
          const body = {
            data: {
              attributes: {
                requester_id: isSelfApproval ? 42 : 420,
              },
            },
          } as SmartActionApprovalRequestBody;

          const actionPermissionService = factories.actionPermission.mockAllMethods().build();
          const forestAdminClient = new ForestAdminClient(
            factories.forestAdminClientOptions.build(),
            actionPermissionService,
            factories.renderingPermission.build(),
          );

          (actionPermissionService.can as jest.Mock).mockResolvedValue(true);
          generateCustomActionIdentifierMock.mockReturnValue('identifier');
          verifyAndExtractApprovalMock.mockReturnValue(null);

          const result = await forestAdminClient.canExecuteCustomAction({
            userId: 42,
            customActionName: 'doSomething',
            collectionName: 'jedis',
            body,
          });

          expect(actionPermissionService.can).toHaveBeenCalledWith('42', 'identifier');
          expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
            expectedEvent,
            'doSomething',
            'jedis',
          );
          expect(result).toBe(body);
        });

        it('should return false if the user does not have the right', async () => {
          const body = {
            data: {
              attributes: {
                requester_id: isSelfApproval ? 42 : 420,
              },
            },
          } as SmartActionApprovalRequestBody;

          const actionPermissionService = factories.actionPermission.mockAllMethods().build();
          const forestAdminClient = new ForestAdminClient(
            factories.forestAdminClientOptions.build(),
            actionPermissionService,
            factories.renderingPermission.build(),
          );

          (actionPermissionService.can as jest.Mock).mockResolvedValue(false);
          generateCustomActionIdentifierMock.mockReturnValue('identifier');
          verifyAndExtractApprovalMock.mockReturnValue(null);

          const result = await forestAdminClient.canExecuteCustomAction({
            userId: 42,
            customActionName: 'doSomething',
            collectionName: 'jedis',
            body,
          });

          expect(result).toBe(false);
        });
      });
    });
  });

  describe('canExecuteCustomActionHook', () => {
    it('should check if the user has the right to trigger or trigger with approval', async () => {
      const actionPermissionService = factories.actionPermission.mockAllMethods().build();
      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        actionPermissionService,
        factories.renderingPermission.build(),
      );

      (actionPermissionService.canOneOf as jest.Mock).mockResolvedValue(true);
      generateCustomActionIdentifierMock.mockReturnValueOnce('identifier1');
      generateCustomActionIdentifierMock.mockReturnValueOnce('identifier2');

      const result = await forestAdminClient.canExecuteCustomActionHook({
        userId: 42,
        customActionName: 'doSomething',
        collectionName: 'jedis',
      });

      expect(actionPermissionService.canOneOf).toHaveBeenCalledWith('42', [
        'identifier1',
        'identifier2',
      ]);
      expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
        CustomActionEvent.Trigger,
        'doSomething',
        'jedis',
      );
      expect(generateCustomActionIdentifierMock).toHaveBeenCalledWith(
        CustomActionEvent.RequireApproval,
        'doSomething',
        'jedis',
      );
      expect(result).toBe(true);
    });
  });

  describe('canRetrieveChart', () => {
    it('should check if the user has the right to display the chart', async () => {
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.actionPermission.build(),
        renderingPermissionService,
      );

      (renderingPermissionService.canRetrieveChart as jest.Mock).mockResolvedValue(true);

      const result = await forestAdminClient.canRetrieveChart({
        userId: 42,
        renderingId: 666,
        chartRequest: { foo: 'bar' },
      });

      expect(renderingPermissionService.canRetrieveChart).toHaveBeenCalledWith({
        userId: 42,
        renderingId: 666,
        chartRequest: { foo: 'bar' },
      });
      expect(result).toBe(true);
    });
  });

  describe('markScopesAsUpdated', () => {
    it('should invalidate the cache of scopes', async () => {
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.actionPermission.build(),
        renderingPermissionService,
      );

      await forestAdminClient.markScopesAsUpdated(42);

      expect(renderingPermissionService.invalidateCache).toHaveBeenCalledWith(42);
    });
  });

  describe('getScope', () => {
    it('should return the scope from the rendering service', async () => {
      const renderingPermissionService = factories.renderingPermission.mockAllMethods().build();
      const forestAdminClient = new ForestAdminClient(
        factories.forestAdminClientOptions.build(),
        factories.actionPermission.build(),
        renderingPermissionService,
      );

      (renderingPermissionService.getScope as jest.Mock).mockResolvedValue('scope');

      const result = await forestAdminClient.getScope({
        renderingId: 666,
        collectionName: 'jedis',
        user: { id: 42, tags: {} },
      });

      expect(renderingPermissionService.getScope).toHaveBeenCalledWith({
        collectionName: 'jedis',
        renderingId: 666,
        user: { id: 42, tags: {} },
      });
      expect(result).toBe('scope');
    });
  });
});
