import {
  Aggregation,
  Caller,
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  Filter,
  ForbiddenError,
} from '@forestadmin/datasource-toolkit';
import { ForestAdminClient } from '@forestadmin/forestadmin-client';
import hashObject from 'object-hash';

import ConditionTreeParser from '../../utils/condition-tree-parser';
import ApprovalNotAllowedError from './errors/approvalNotAllowedError';
import CustomActionRequiresApprovalError from './errors/customActionRequiresApprovalError';
import CustomActionTriggerForbiddenError from './errors/customActionTriggerForbiddenError';
import InvalidActionConditionError from './errors/invalidActionConditionError';

type CanPerformCustomActionParams = {
  userId: string | number;
  customActionName: string;
  collection: Collection;
  requestConditionTreeForCaller: ConditionTree;
  requestConditionTreeForAllCaller: ConditionTree;
  caller: Caller;
};

export default class ActionAuthorizationService {
  constructor(private readonly forestAdminClient: ForestAdminClient) {}

  public async assertCanTriggerCustomAction({
    userId,
    customActionName,
    collection,
    requestConditionTreeForCaller,
    requestConditionTreeForAllCaller,
    caller,
  }: CanPerformCustomActionParams): Promise<void> {
    const canTrigger = await this.canTriggerCustomAction(
      userId,
      customActionName,
      collection,
      requestConditionTreeForCaller,
      caller,
    );

    if (!canTrigger) {
      throw new CustomActionTriggerForbiddenError();
    }

    const triggerRequiresApproval = await this.doesTriggerCustomActionRequiresApproval(
      userId,
      customActionName,
      collection,
      requestConditionTreeForCaller,
      caller,
    );

    if (triggerRequiresApproval) {
      const roleIdsAllowedToApprove = await this.getRoleIdsAllowedToApprove(
        caller,
        customActionName,
        collection,
        requestConditionTreeForAllCaller,
      );

      throw new CustomActionRequiresApprovalError(roleIdsAllowedToApprove);
    }
  }

  public async assertCanApproveCustomAction({
    userId,
    customActionName,
    requesterId,
    collection,
    requestConditionTreeForCaller,
    requestConditionTreeForAllCaller,
    caller,
  }: CanPerformCustomActionParams & {
    requesterId: number | string;
  }): Promise<void> {
    const canApprove = await this.canApproveCustomAction(
      userId,
      customActionName,
      collection,
      requestConditionTreeForCaller,
      caller,
      requesterId,
    );

    if (!canApprove) {
      const roleIdsAllowedToApprove = await this.getRoleIdsAllowedToApprove(
        caller,
        customActionName,
        collection,
        requestConditionTreeForAllCaller,
      );

      throw new ApprovalNotAllowedError(roleIdsAllowedToApprove);
    }
  }

  public async assertCanRequestCustomActionParameters(
    userId: string | number,
    customActionName: string,
    collectionName: string,
  ) {
    const canRequest =
      await this.forestAdminClient.permissionService.canRequestCustomActionParameters({
        userId,
        customActionName,
        collectionName,
      });

    if (!canRequest) {
      throw new ForbiddenError();
    }
  }

  private async canTriggerCustomAction(
    userId: string | number,
    customActionName: string,
    collection: Collection,
    requestConditionTreeForCaller: ConditionTree,
    caller: Caller,
  ): Promise<boolean> {
    const canTrigger = await this.forestAdminClient.permissionService.canTriggerCustomAction({
      userId,
      customActionName,
      collectionName: collection.name,
    });

    if (!canTrigger) {
      return false;
    }

    const conditionalTriggerRawCondition =
      await this.forestAdminClient.permissionService.getConditionalTriggerCondition({
        userId,
        customActionName,
        collectionName: collection.name,
      });

    return ActionAuthorizationService.canPerformConditionalCustomAction(
      caller,
      collection,
      requestConditionTreeForCaller,
      conditionalTriggerRawCondition,
    );
  }

  private async doesTriggerCustomActionRequiresApproval(
    userId: string | number,
    customActionName: string,
    collection: Collection,
    requestConditionTreeForCaller: ConditionTree,
    caller: Caller,
  ): Promise<boolean> {
    const doesTriggerRequiresApproval =
      await this.forestAdminClient.permissionService.doesTriggerCustomActionRequiresApproval({
        userId,
        customActionName,
        collectionName: collection.name,
      });

    if (!doesTriggerRequiresApproval) {
      return false;
    }

    const conditionalRequiresApprovalRawCondition =
      await this.forestAdminClient.permissionService.getConditionalRequiresApprovalCondition({
        userId,
        customActionName,
        collectionName: collection.name,
      });

    if (conditionalRequiresApprovalRawCondition) {
      const matchingRecordsCount = await ActionAuthorizationService.intersectCount(
        caller,
        collection,
        requestConditionTreeForCaller,
        conditionalRequiresApprovalRawCondition,
      );

      // No records match the condition, trigger does not require approval
      if (matchingRecordsCount === 0) {
        return false;
      }
    }

    return true;
  }

  private async canApproveCustomAction(
    userId: string | number,
    customActionName: string,
    collection: Collection,
    requestConditionTreeForCaller: ConditionTree,
    caller: Caller,
    requesterId: number | string,
  ): Promise<boolean> {
    const canApprove = await this.forestAdminClient.permissionService.canApproveCustomAction({
      userId,
      customActionName,
      collectionName: collection.name,
      requesterId,
    });

    if (!canApprove) {
      return false;
    }

    const conditionalApproveRawCondition =
      await this.forestAdminClient.permissionService.getConditionalApproveCondition({
        userId,
        customActionName,
        collectionName: collection.name,
      });

    return ActionAuthorizationService.canPerformConditionalCustomAction(
      caller,
      collection,
      requestConditionTreeForCaller,
      conditionalApproveRawCondition,
    );
  }

  private async getRoleIdsAllowedToApprove(
    caller: Caller,
    customActionName: string,
    collection: Collection,
    requestConditionTreeForAllCaller: ConditionTree,
  ) {
    const actionConditionsByRoleId =
      await this.forestAdminClient.permissionService.getConditionalApproveConditions({
        customActionName,
        collectionName: collection.name,
      });
    const roleIdsAllowedToApproveWithoutConditions =
      await this.forestAdminClient.permissionService.getRoleIdsAllowedToApproveWithoutConditions({
        customActionName,
        collectionName: collection.name,
      });

    const rolesIdsGroupByConditions =
      ActionAuthorizationService.transformToRolesIdsGroupByConditions(actionConditionsByRoleId);

    let requestRecordsCount: number;
    let conditionRecordsCounts: number[];

    if (rolesIdsGroupByConditions.length > 0) {
      // Currently we are making one call for nothing in this case
      [requestRecordsCount, ...conditionRecordsCounts] = await Promise.all([
        ActionAuthorizationService.intersectCount(
          caller,
          collection,
          requestConditionTreeForAllCaller,
        ),
        ...rolesIdsGroupByConditions.map(({ condition }) =>
          ActionAuthorizationService.intersectCount(
            caller,
            collection,
            requestConditionTreeForAllCaller,
            condition,
          ),
        ),
      ]);
    }

    return rolesIdsGroupByConditions.reduce(
      (roleIdsAllowedToApprove, { roleIds }, currentIndex) => {
        if (requestRecordsCount === conditionRecordsCounts[currentIndex]) {
          roleIdsAllowedToApprove.push(...roleIds);
        }

        return roleIdsAllowedToApprove;
      },
      // Roles  with userApprovalEnabled excluding the one with conditions
      // are allowed to approve by default
      roleIdsAllowedToApproveWithoutConditions,
    );
  }

  private static async intersectCount(
    caller: Caller,
    collection: Collection,
    requestConditionTree: ConditionTree,
    conditionalRawCondition?: unknown,
  ) {
    try {
      // Build filter format with the right format
      const conditionalFilter = new Filter({
        conditionTree: conditionalRawCondition
          ? ConditionTreeFactory.intersect(
              ConditionTreeParser.fromPlainObject(collection, conditionalRawCondition),
              requestConditionTree,
            )
          : requestConditionTree,
      });

      const rows = await collection.aggregate(
        caller,
        conditionalFilter,
        new Aggregation({
          operation: 'Count',
        }),
      );

      return (rows?.[0]?.value as number) ?? 0;
    } catch (error) {
      throw new InvalidActionConditionError();
    }
  }

  private static async canPerformConditionalCustomAction(
    caller: Caller,
    collection: Collection,
    requestConditionTree: ConditionTree,
    conditionalRawCondition: unknown | null,
  ) {
    if (conditionalRawCondition) {
      const [requestRecordsCount, matchingRecordsCount] = await Promise.all([
        ActionAuthorizationService.intersectCount(caller, collection, requestConditionTree),
        ActionAuthorizationService.intersectCount(
          caller,
          collection,
          requestConditionTree,
          conditionalRawCondition,
        ),
      ]);

      // If some records don't match the condition then the user
      // is not allow to perform the conditional action
      if (matchingRecordsCount !== requestRecordsCount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Given a map it groups keys based on their hash values
   * @param actionConditionsByRoleId
   * @returns
   */
  private static transformToRolesIdsGroupByConditions<T>(
    actionConditionsByRoleId: Map<number, T>,
  ): {
    roleIds: number[];
    condition: T;
  }[] {
    const rolesIdsGroupByConditions = Array.from(
      actionConditionsByRoleId,
      ([roleId, condition]) => {
        return {
          roleId,
          condition,
          conditionHash: hashObject(condition, { respectType: false }),
        };
      },
    ).reduce((acc, current) => {
      const { roleId, condition, conditionHash } = current;

      if (acc.has(conditionHash)) {
        acc.get(conditionHash).roleIds.push(roleId);
      } else {
        acc.set(conditionHash, { roleIds: [roleId], condition });
      }

      return acc;
    }, new Map<string, { roleIds: number[]; condition: T }>());

    return Array.from(rolesIdsGroupByConditions.values());
  }
}
