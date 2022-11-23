import { ForbiddenError } from '@forestadmin/datasource-toolkit';
import {
  ChainedSQLQueryError,
  ChartType,
  CollectionActionEvent,
  EmptySQLQueryError,
  ForestAdminClient,
  NonSelectSQLQueryError,
} from '@forestadmin/forestadmin-client';
import { Context } from 'koa';

import AuthorizationService from '../../../src/services/authorization/authorization';
import ApprovalNotAllowedError from '../../../src/services/authorization/errors/approvalNotAllowedError';
import CustomActionRequiresApprovalError from '../../../src/services/authorization/errors/customActionRequiresApprovalError';
import CustomActionTriggerForbiddenError from '../../../src/services/authorization/errors/customActionTriggerForbiddenError';
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

  describe('assertCanTriggerCustomAction', () => {
    let forestAdminClient: ForestAdminClient;
    describe('trigger does not require approval', () => {
      beforeEach(() => {
        forestAdminClient = factories.forestAdminClient.build();
        (
          forestAdminClient.permissionService.doesTriggerCustomActionRequiresApproval as jest.Mock
        ).mockResolvedValue(false);
      });

      it('should do nothing if the user can trigger a custom action', async () => {
        const context = { state: { user: { id: 42 } } } as Context;

        (forestAdminClient.permissionService.canTriggerCustomAction as jest.Mock).mockResolvedValue(
          true,
        );

        const authorization = new AuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanTriggerCustomAction({
            context,
            customActionName: 'do-something',
            collection: factories.collection.build({ name: 'actors' }),
            requestConditionTreeForCaller: factories.conditionTreeLeaf.build(),
            requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
            caller: factories.caller.build(),
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

        (forestAdminClient.permissionService.canTriggerCustomAction as jest.Mock).mockResolvedValue(
          false,
        );

        const authorization = new AuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanTriggerCustomAction({
            context,
            customActionName: 'do-something',
            collection: factories.collection.build({ name: 'actors' }),
            requestConditionTreeForCaller: factories.conditionTreeLeaf.build(),
            requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
            caller: factories.caller.build(),
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
          ).mockResolvedValue(factories.conditionTreeLeaf.build());
        });

        it('should do nothing if the user can perform conditional trigger', async () => {
          const context = { state: { user: { id: 42 } } } as Context;

          const collection = factories.collection.build({ name: 'actors' });
          // All aggregate returns the same results user can perform conditional trigger
          (collection.aggregate as jest.Mock).mockResolvedValue([{ value: 16 }]);

          const authorization = new AuthorizationService(forestAdminClient);

          await expect(
            authorization.assertCanTriggerCustomAction({
              context,
              customActionName: 'do-something',
              collection,
              requestConditionTreeForCaller: factories.conditionTreeLeaf.build(),
              requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
              caller: factories.caller.build(),
            }),
          ).resolves.toBe(undefined);

          expect(
            forestAdminClient.permissionService.getConditionalTriggerCondition,
          ).toHaveBeenCalledWith({
            userId: 42,
            customActionName: 'do-something',
            collectionName: 'actors',
          });

          expect(collection.aggregate).toHaveBeenCalledTimes(2);
        });

        it('should throw an error if cannot perform conditional trigger', async () => {
          const context = { state: { user: { id: 42 } } } as Context;

          const collection = factories.collection.build({ name: 'actors' });
          // Aggregate returns different results user cannot perform conditional trigger
          (collection.aggregate as jest.Mock)
            .mockResolvedValueOnce([{ value: 16 }])
            .mockResolvedValueOnce([{ value: 2 }]);

          const authorization = new AuthorizationService(forestAdminClient);

          await expect(
            authorization.assertCanTriggerCustomAction({
              context,
              customActionName: 'do-something',
              collection,
              requestConditionTreeForCaller: factories.conditionTreeLeaf.build(),
              requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
              caller: factories.caller.build(),
            }),
          ).rejects.toThrow(CustomActionTriggerForbiddenError);

          expect(collection.aggregate).toHaveBeenCalledTimes(2);
        });
      });
    });

    describe('trigger does require approval', () => {
      beforeEach(() => {
        forestAdminClient = factories.forestAdminClient.build();
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
          const context = {
            state: { user: { id: 42 } },
            throw: jest.fn(),
          } as unknown as Context;

          (
            forestAdminClient.permissionService.getConditionalRequiresApprovalCondition as jest.Mock
          ).mockResolvedValue(null);

          const authorization = new AuthorizationService(forestAdminClient);

          await expect(
            authorization.assertCanTriggerCustomAction({
              context,
              customActionName: 'do-something',
              collection: factories.collection.build({ name: 'actors' }),
              requestConditionTreeForCaller: factories.conditionTreeLeaf.build(),
              requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
              caller: factories.caller.build(),
            }),
          ).rejects.toThrowError(new CustomActionRequiresApprovalError([1, 16]));
        },
      );

      describe('with "RequiresApproval" condition (conditional use case)', () => {
        beforeEach(() => {
          (
            forestAdminClient.permissionService.getConditionalRequiresApprovalCondition as jest.Mock
          ).mockResolvedValue(factories.conditionTreeLeaf.build());
        });

        it('should do nothing if no records match the "RequiresApproval" condition', async () => {
          const context = { state: { user: { id: 42 } } } as Context;

          const collection = factories.collection.build({ name: 'actors' });
          // No records matching condition approval not required
          (collection.aggregate as jest.Mock).mockResolvedValue([{ value: 0 }]);

          const authorization = new AuthorizationService(forestAdminClient);

          await expect(
            authorization.assertCanTriggerCustomAction({
              context,
              customActionName: 'do-something',
              collection,
              requestConditionTreeForCaller: factories.conditionTreeLeaf.build(),
              requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
              caller: factories.caller.build(),
            }),
          ).resolves.toBe(undefined);

          expect(
            forestAdminClient.permissionService.getConditionalRequiresApprovalCondition,
          ).toHaveBeenCalledWith({
            userId: 42,
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
            const context = {
              state: { user: { id: 42 } },
              throw: jest.fn(),
            } as unknown as Context;

            const collection = factories.collection.build({ name: 'actors' });
            (collection.aggregate as jest.Mock).mockResolvedValueOnce([{ value: 3 }]);

            const authorization = new AuthorizationService(forestAdminClient);

            await expect(
              authorization.assertCanTriggerCustomAction({
                context,
                customActionName: 'do-something',
                collection,
                requestConditionTreeForCaller: factories.conditionTreeLeaf.build(),
                requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
                caller: factories.caller.build(),
              }),
            ).rejects.toThrowError(new CustomActionRequiresApprovalError([1, 16]));

            // One time during doesTriggerCustomActionRequiresApproval
            // Not called during roleIdsAllowedToApprove computation (No Approve condition)
            expect(collection.aggregate).toHaveBeenCalledTimes(1);
          },
        );
      });
    });
  });

  describe('assertCanApproveCustomAction', () => {
    let forestAdminClient: ForestAdminClient;
    describe('without "Approval" condition (basic use case)', () => {
      beforeEach(() => {
        forestAdminClient = factories.forestAdminClient.build();
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
        const context = { state: { user: { id: 42 } } } as Context;
        const caller = factories.caller.build();
        const collection = factories.collection.build({ name: 'actors' });
        const requestConditionTreeForCaller = factories.conditionTreeLeaf.build();

        (forestAdminClient.permissionService.canApproveCustomAction as jest.Mock).mockResolvedValue(
          true,
        );

        (
          forestAdminClient.permissionService.getConditionalApproveCondition as jest.Mock
        ).mockResolvedValue(null);

        const authorization = new AuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanApproveCustomAction({
            context,
            customActionName: 'do-something',
            collection,
            requestConditionTreeForCaller,
            requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
            caller,
            requesterId: 30,
          }),
        ).resolves.toBe(undefined);

        expect(forestAdminClient.permissionService.canApproveCustomAction).toHaveBeenCalledWith({
          userId: 42,
          customActionName: 'do-something',
          collectionName: 'actors',
          requesterId: 30,
        });

        expect(
          forestAdminClient.permissionService.getConditionalApproveCondition,
        ).toHaveBeenCalledWith({
          userId: 42,
          customActionName: 'do-something',
          collectionName: 'actors',
        });

        expect(collection.aggregate).not.toHaveBeenCalled();
      });

      it('should throw an error if the user cannot approve', async () => {
        const context = {
          state: { user: { id: 42 } },
          throw: jest.fn(),
        } as unknown as Context;

        const collection = factories.collection.build({ name: 'actors' });

        (forestAdminClient.permissionService.canApproveCustomAction as jest.Mock).mockResolvedValue(
          false,
        );

        const authorization = new AuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanApproveCustomAction({
            context,
            customActionName: 'do-something',
            collection,
            requestConditionTreeForCaller: factories.conditionTreeLeaf.build(),
            requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
            caller: factories.caller.build(),
            requesterId: 30,
          }),
        ).rejects.toThrowError(new ApprovalNotAllowedError([10, 12, 13]));

        expect(collection.aggregate).not.toHaveBeenCalled();
      });
    });

    describe('with "Approval" condition (conditional use case)', () => {
      beforeEach(() => {
        forestAdminClient = factories.forestAdminClient.build();

        (forestAdminClient.permissionService.canApproveCustomAction as jest.Mock).mockResolvedValue(
          true,
        );

        (
          forestAdminClient.permissionService.getConditionalApproveCondition as jest.Mock
        ).mockResolvedValue(factories.conditionTreeLeaf.build());

        (
          forestAdminClient.permissionService.getConditionalApproveConditions as jest.Mock
        ).mockResolvedValue(
          new Map([
            [
              10,
              {
                value: 'some',
                field: 'definition',
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
        const context = { state: { user: { id: 42 } } } as Context;
        const caller = factories.caller.build();
        const collection = factories.collection.build({ name: 'actors' });
        const requestConditionTreeForCaller = factories.conditionTreeLeaf.build();

        (collection.aggregate as jest.Mock).mockResolvedValue([{ value: 3 }]);

        const authorization = new AuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanApproveCustomAction({
            context,
            customActionName: 'do-something',
            collection,
            requestConditionTreeForCaller,
            requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
            caller,
            requesterId: 30,
          }),
        ).resolves.toBe(undefined);

        expect(collection.aggregate).toHaveBeenCalledTimes(2);
      });

      it('should throw an error ApprovalNotAllowedError', async () => {
        const context = {
          state: { user: { id: 42 } },
          throw: jest.fn(),
        } as unknown as Context;

        const collection = factories.collection.build({ name: 'actors' });

        (collection.aggregate as jest.Mock).mockResolvedValueOnce([{ value: 3 }]);

        const authorization = new AuthorizationService(forestAdminClient);

        await expect(
          authorization.assertCanApproveCustomAction({
            context,
            customActionName: 'do-something',
            collection,
            requestConditionTreeForCaller: factories.conditionTreeLeaf.build(),
            requestConditionTreeForAllCaller: factories.conditionTreeLeaf.build(),
            caller: factories.caller.build(),
            requesterId: 30,
          }),
        ).rejects.toThrowError(new ApprovalNotAllowedError([1, 10, 16]));

        expect(collection.aggregate).toHaveBeenCalledTimes(4);
      });
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

      await expect(
        authorizationService.assertCanRequestCustomActionParameters(
          context,
          'custom-action',
          'books',
        ),
      ).rejects.toThrow(new ForbiddenError());
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
