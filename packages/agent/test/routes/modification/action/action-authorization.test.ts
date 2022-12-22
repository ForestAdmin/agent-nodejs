import { ForbiddenError } from '@forestadmin/datasource-toolkit';
import { ForestAdminClient } from '@forestadmin/forestadmin-client';

import ActionAuthorizationService from '../../../../src/routes/modification/action/action-authorization';
import CustomActionTriggerForbiddenError from '../../../../src/routes/modification/action/errors/customActionTriggerForbiddenError';
import InvalidActionConditionError from '../../../../src/routes/modification/action/errors/invalidActionConditionError';
import * as factories from '../../../__factories__';

describe('ActionAuthorizationService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const forestAdminClient: ForestAdminClient = factories.forestAdminClient.build();

  const caller = factories.caller.build();

  const collection = factories.collection.build({
    name: 'actors',
    schema: factories.collectionSchema.build({
      fields: {
        id: factories.columnSchema.uuidPrimaryKey().build(),
        name: factories.columnSchema.build({ columnType: 'String' }),
      },
    }),
  });

  const filterForCaller = factories.filter.build();
  const filterForAllCaller = factories.filter.build();

  const condition = {
    value: 'someName',
    field: 'name',
    operator: 'equal',
    source: 'data',
  };

  describe('assertCanTriggerCustomAction', () => {
    describe('trigger does not require approval', () => {
      beforeEach(() => {
        (
          forestAdminClient.permissionService.doesTriggerCustomActionRequiresApproval as jest.Mock
        ).mockResolvedValue(false);
      });

      it('should do nothing if the user can trigger a custom action', async () => {
        (forestAdminClient.permissionService.canTriggerCustomAction as jest.Mock).mockResolvedValue(
          true,
        );

        const authorization = new ActionAuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanTriggerCustomAction({
            customActionName: 'do-something',
            collection,
            filterForCaller,
            filterForAllCaller,
            caller,
          }),
        ).resolves.toBe(undefined);

        expect(forestAdminClient.permissionService.canTriggerCustomAction).toHaveBeenCalledWith({
          userId: 1,
          customActionName: 'do-something',
          collectionName: 'actors',
        });
      });

      it('should throw an error if the user cannot trigger', async () => {
        (forestAdminClient.permissionService.canTriggerCustomAction as jest.Mock).mockResolvedValue(
          false,
        );

        const authorization = new ActionAuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanTriggerCustomAction({
            customActionName: 'do-something',
            collection,
            filterForCaller,
            filterForAllCaller,
            caller,
          }),
        ).rejects.toThrow(CustomActionTriggerForbiddenError);
      });

      describe('with "Trigger" condition (conditional use case)', () => {
        beforeEach(() => {
          // user can trigger from permission
          (
            forestAdminClient.permissionService.canTriggerCustomAction as jest.Mock
          ).mockResolvedValue(true);

          (
            forestAdminClient.permissionService.getConditionalTriggerCondition as jest.Mock
          ).mockResolvedValue(condition);
        });

        it('should do nothing if the user can perform conditional trigger', async () => {
          // All aggregate returns the same results user can perform conditional trigger
          (collection.aggregate as jest.Mock).mockResolvedValue([{ value: 16 }]);

          const authorization = new ActionAuthorizationService(forestAdminClient);

          await expect(
            authorization.assertCanTriggerCustomAction({
              customActionName: 'do-something',
              collection,
              filterForCaller,
              filterForAllCaller,
              caller,
            }),
          ).resolves.toBe(undefined);

          expect(
            forestAdminClient.permissionService.getConditionalTriggerCondition,
          ).toHaveBeenCalledWith({
            userId: 1,
            customActionName: 'do-something',
            collectionName: 'actors',
          });

          expect(collection.aggregate).toHaveBeenCalledTimes(2);
        });

        it('should throw an error if cannot perform conditional trigger', async () => {
          // Aggregate returns different results user cannot perform conditional trigger
          (collection.aggregate as jest.Mock)
            .mockResolvedValueOnce([{ value: 16 }])
            .mockResolvedValueOnce([{ value: 2 }]);

          const authorization = new ActionAuthorizationService(forestAdminClient);

          await expect(
            authorization.assertCanTriggerCustomAction({
              customActionName: 'do-something',
              collection,
              filterForCaller,
              filterForAllCaller,
              caller,
            }),
          ).rejects.toThrow(CustomActionTriggerForbiddenError);

          expect(collection.aggregate).toHaveBeenCalledTimes(2);
        });
      });
    });

    describe('trigger does require approval', () => {
      beforeEach(() => {
        (
          forestAdminClient.permissionService.doesTriggerCustomActionRequiresApproval as jest.Mock
        ).mockResolvedValue(true);

        // We test the require approval so yes the user can trigger
        (forestAdminClient.permissionService.canTriggerCustomAction as jest.Mock).mockResolvedValue(
          true,
        );

        // No Approve conditions for any roles for this action
        (
          forestAdminClient.permissionService.getConditionalApproveConditions as jest.Mock
        ).mockResolvedValue(new Map());

        (
          forestAdminClient.permissionService
            .getRoleIdsAllowedToApproveWithoutConditions as jest.Mock
        ).mockResolvedValue([1, 16]);
      });

      it(
        'should throw an error CustomActionRequiresApprovalError with the ' +
          'RoleIdsAllowedToApprove',
        async () => {
          (
            forestAdminClient.permissionService.getConditionalRequiresApprovalCondition as jest.Mock
          ).mockResolvedValue(null);

          const authorization = new ActionAuthorizationService(forestAdminClient);

          await expect(
            authorization.assertCanTriggerCustomAction({
              customActionName: 'do-something',
              collection,
              filterForCaller,
              filterForAllCaller,
              caller,
            }),
          ).rejects.toMatchObject({
            name: 'CustomActionRequiresApprovalError',
            message: 'This action requires to be approved.',
            data: {
              roleIdsAllowedToApprove: [1, 16],
            },
          });
        },
      );

      describe('with "RequiresApproval" condition (conditional use case)', () => {
        beforeEach(() => {
          (
            forestAdminClient.permissionService.getConditionalRequiresApprovalCondition as jest.Mock
          ).mockResolvedValue(condition);
        });

        it('should do nothing if no records match the "RequiresApproval" condition', async () => {
          // No records matching condition approval not required
          (collection.aggregate as jest.Mock).mockResolvedValue([{ value: 0 }]);

          const authorization = new ActionAuthorizationService(forestAdminClient);

          await expect(
            authorization.assertCanTriggerCustomAction({
              customActionName: 'do-something',
              collection,
              filterForCaller,
              filterForAllCaller,
              caller,
            }),
          ).resolves.toBe(undefined);

          expect(
            forestAdminClient.permissionService.getConditionalRequiresApprovalCondition,
          ).toHaveBeenCalledWith({
            userId: 1,
            customActionName: 'do-something',
            collectionName: 'actors',
          });

          // One time during doesTriggerCustomActionRequiresApproval
          // Not called during roleIdsAllowedToApprove computation (No Approve condition)
          expect(collection.aggregate).toHaveBeenCalledTimes(1);
        });

        it(
          'should throw an error CustomActionRequiresApprovalError ' +
            'if some records on which the CustomAction is executed match condition',
          async () => {
            (collection.aggregate as jest.Mock).mockResolvedValueOnce([{ value: 3 }]);

            const authorization = new ActionAuthorizationService(forestAdminClient);

            await expect(
              authorization.assertCanTriggerCustomAction({
                customActionName: 'do-something',
                collection,
                filterForCaller,
                filterForAllCaller,
                caller,
              }),
            ).rejects.toMatchObject({
              name: 'CustomActionRequiresApprovalError',
              message: 'This action requires to be approved.',
              data: {
                roleIdsAllowedToApprove: [1, 16],
              },
            });

            // One time during doesTriggerCustomActionRequiresApproval
            // Not called during roleIdsAllowedToApprove computation (No Approve condition)
            expect(collection.aggregate).toHaveBeenCalledTimes(1);
          },
        );

        it(
          'should throw an error InvalidActionConditionError when we cannot compute the ' +
            ' filter',
          async () => {
            (
              forestAdminClient.permissionService
                .getConditionalRequiresApprovalCondition as jest.Mock
            ).mockResolvedValue({
              value: 'invalidField',
              field: 'invalid',
              operator: 'equal',
              source: 'data',
            });

            const authorization = new ActionAuthorizationService(forestAdminClient);

            await expect(
              authorization.assertCanTriggerCustomAction({
                customActionName: 'do-something',
                collection,
                filterForCaller,
                filterForAllCaller,
                caller,
              }),
            ).rejects.toThrowError(new InvalidActionConditionError());
          },
        );

        it(
          'should throw an error InvalidActionConditionError when we cannot compute the ' +
            ' aggregate count',
          async () => {
            (collection.aggregate as jest.Mock).mockRejectedValue(
              new Error('Some internal driver error'),
            );

            const authorization = new ActionAuthorizationService(forestAdminClient);

            await expect(
              authorization.assertCanTriggerCustomAction({
                customActionName: 'do-something',
                collection,
                filterForCaller,
                filterForAllCaller,
                caller,
              }),
            ).rejects.toThrowError(new InvalidActionConditionError());
          },
        );
      });
    });
  });

  describe('assertCanApproveCustomAction', () => {
    describe('without "Approval" condition (basic use case)', () => {
      beforeEach(() => {
        // No Approve conditions for any roles for this action
        (
          forestAdminClient.permissionService.getConditionalApproveConditions as jest.Mock
        ).mockResolvedValue(new Map());

        (
          forestAdminClient.permissionService
            .getRoleIdsAllowedToApproveWithoutConditions as jest.Mock
        ).mockResolvedValue([1, 16]);
      });

      it('should do nothing if the user can approve a custom action', async () => {
        (forestAdminClient.permissionService.canApproveCustomAction as jest.Mock).mockResolvedValue(
          true,
        );

        (
          forestAdminClient.permissionService.getConditionalApproveCondition as jest.Mock
        ).mockResolvedValue(null);

        const authorization = new ActionAuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanApproveCustomAction({
            customActionName: 'do-something',
            collection,
            filterForCaller,
            filterForAllCaller,
            caller,
            requesterId: 30,
          }),
        ).resolves.toBe(undefined);

        expect(forestAdminClient.permissionService.canApproveCustomAction).toHaveBeenCalledWith({
          userId: 1,
          customActionName: 'do-something',
          collectionName: 'actors',
          requesterId: 30,
        });

        expect(
          forestAdminClient.permissionService.getConditionalApproveCondition,
        ).toHaveBeenCalledWith({
          userId: 1,
          customActionName: 'do-something',
          collectionName: 'actors',
        });

        expect(collection.aggregate).not.toHaveBeenCalled();
      });

      it('should throw an error if the user cannot approve', async () => {
        (forestAdminClient.permissionService.canApproveCustomAction as jest.Mock).mockResolvedValue(
          false,
        );

        const authorization = new ActionAuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanApproveCustomAction({
            customActionName: 'do-something',
            collection,
            filterForCaller,
            filterForAllCaller,
            caller,
            requesterId: 30,
          }),
        ).rejects.toMatchObject({
          name: 'ApprovalNotAllowedError',
          message: "You don't have permission to approve this action.",
          data: {
            roleIdsAllowedToApprove: [1, 16],
          },
        });

        expect(collection.aggregate).not.toHaveBeenCalled();
      });
    });

    describe('with "Approval" condition (conditional use case)', () => {
      beforeEach(() => {
        (forestAdminClient.permissionService.canApproveCustomAction as jest.Mock).mockResolvedValue(
          true,
        );

        (
          forestAdminClient.permissionService.getConditionalApproveCondition as jest.Mock
        ).mockResolvedValue(condition);

        (
          forestAdminClient.permissionService.getConditionalApproveConditions as jest.Mock
        ).mockResolvedValue(
          new Map([
            [
              10,
              {
                value: 'some',
                field: 'name',
                operator: 'Equal',
                source: 'data',
              },
            ],
            [
              20,
              {
                value: 'some',
                field: 'name',
                operator: 'Equal',
                source: 'data',
              },
            ],
          ]),
        );

        (
          forestAdminClient.permissionService
            .getRoleIdsAllowedToApproveWithoutConditions as jest.Mock
        ).mockResolvedValue([1, 16]);
      });

      it('should do nothing if the user can approve a custom action', async () => {
        (collection.aggregate as jest.Mock).mockResolvedValue([{ value: 3 }]);

        const authorization = new ActionAuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanApproveCustomAction({
            customActionName: 'do-something',
            collection,
            filterForCaller,
            filterForAllCaller,
            caller,
            requesterId: 30,
          }),
        ).resolves.toBe(undefined);

        expect(collection.aggregate).toHaveBeenCalledTimes(2);
      });

      it('should throw an error ApprovalNotAllowedError', async () => {
        (collection.aggregate as jest.Mock).mockResolvedValueOnce([{ value: 3 }]);

        const authorization = new ActionAuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanApproveCustomAction({
            customActionName: 'do-something',
            collection,
            filterForCaller,
            filterForAllCaller,
            caller,
            requesterId: 30,
          }),
        ).rejects.toMatchObject({
          name: 'ApprovalNotAllowedError',
          message: "You don't have permission to approve this action.",
          data: {
            roleIdsAllowedToApprove: [1, 16, 10, 20],
          },
        });

        // Two time during canApproveCustomAction
        // Two time during roleIdsAllowedToApprove computation
        // Even if there is two approves conditions they have equivalent condition hashes
        // so it's only computed once for both conditions
        // (We group roleId by condition hash to gain performances)
        expect(collection.aggregate).toHaveBeenCalledTimes(4);
      });
    });
  });

  describe('assertCanRequestCustomActionParameters', () => {
    it('should not do anything if the user has the right to execute action hooks', async () => {
      const authorizationService = new ActionAuthorizationService(forestAdminClient);

      (
        forestAdminClient.permissionService.canRequestCustomActionParameters as jest.Mock
      ).mockResolvedValue(true);

      await authorizationService.assertCanRequestCustomActionParameters(
        caller,
        'custom-action',
        'books',
      );

      expect(
        forestAdminClient.permissionService.canRequestCustomActionParameters,
      ).toHaveBeenCalledWith({
        userId: 1,
        customActionName: 'custom-action',
        collectionName: 'books',
      });
    });

    it('should throw an error if the user does not have the right', async () => {
      const authorizationService = new ActionAuthorizationService(forestAdminClient);

      (
        forestAdminClient.permissionService.canRequestCustomActionParameters as jest.Mock
      ).mockResolvedValue(false);

      await expect(
        authorizationService.assertCanRequestCustomActionParameters(
          caller,
          'custom-action',
          'books',
        ),
      ).rejects.toThrow(new ForbiddenError());
    });
  });
});
