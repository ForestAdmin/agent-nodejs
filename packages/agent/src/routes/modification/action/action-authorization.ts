import {
  Aggregation,
  Caller,
  Collection,
  ConditionTreeFactory,
  Filter,
  ForbiddenError,
} from '@forestadmin/datasource-toolkit';
import { ForestAdminClient } from '@forestadmin/forestadmin-client';
import hashObject from 'object-hash';

import ConditionTreeParser from '../../../utils/condition-tree-parser';
import ApprovalNotAllowedError from './errors/approvalNotAllowedError';
import CustomActionRequiresApprovalError from './errors/customActionRequiresApprovalError';
import CustomActionTriggerForbiddenError from './errors/customActionTriggerForbiddenError';
import InvalidActionConditionError from './errors/invalidActionConditionError';

type CanPerformCustomActionParams = {
  caller: Caller;
  customActionName: string;
  collection: Collection;
  filterForCaller: Filter; // Filter that may include scope if any
  filterForAllCaller: Filter; // Filter without scope
};

export default class ActionAuthorizationService {
  constructor(private readonly forestAdminClient: ForestAdminClient) {}

  public async assertCanTriggerCustomAction({
    customActionName,
    collection,
    filterForCaller,
    filterForAllCaller,
    caller,
  }: CanPerformCustomActionParams): Promise<void> {
    const canTrigger = await this.canTriggerCustomAction(
      caller,
      customActionName,
      collection,
      filterForCaller,
    );

    if (!canTrigger) {
      throw new CustomActionTriggerForbiddenError();
    }

    const triggerRequiresApproval = await this.doesTriggerCustomActionRequiresApproval(
      caller,
      customActionName,
      collection,
      filterForCaller,
    );

    if (triggerRequiresApproval) {
      const roleIdsAllowedToApprove = await this.getRoleIdsAllowedToApprove(
        caller,
        customActionName,
        collection,
        filterForAllCaller,
      );

      throw new CustomActionRequiresApprovalError(roleIdsAllowedToApprove);
    }
  }

  public async assertCanApproveCustomAction({
    customActionName,
    requesterId,
    collection,
    filterForCaller,
    filterForAllCaller,
    caller,
  }: CanPerformCustomActionParams & {
    requesterId: number | string;
  }): Promise<void> {
    const canApprove = await this.canApproveCustomAction(
      caller,
      customActionName,
      collection,
      filterForCaller,
      requesterId,
    );

    if (!canApprove) {
      const roleIdsAllowedToApprove = await this.getRoleIdsAllowedToApprove(
        caller,
        customActionName,
        collection,
        filterForAllCaller,
      );

      throw new ApprovalNotAllowedError(roleIdsAllowedToApprove);
    }
  }

  public async assertCanRequestCustomActionParameters(
    caller: Caller,
    customActionName: string,
    collectionName: string,
  ) {
    const canRequest =
      await this.forestAdminClient.permissionService.canRequestCustomActionParameters({
        userId: caller.id,
        customActionName,
        collectionName,
      });

    if (!canRequest) {
      throw new ForbiddenError();
    }
  }

  private async canTriggerCustomAction(
    caller: Caller,
    customActionName: string,
    collection: Collection,
    filterForCaller: Filter,
  ): Promise<boolean> {
    const canTrigger = await this.forestAdminClient.permissionService.canTriggerCustomAction({
      userId: caller.id,
      customActionName,
      collectionName: collection.name,
    });

    if (!canTrigger) {
      return false;
    }

    const conditionalTriggerRawCondition =
      await this.forestAdminClient.permissionService.getConditionalTriggerCondition({
        userId: caller.id,
        customActionName,
        collectionName: collection.name,
      });

    return ActionAuthorizationService.canPerformConditionalCustomAction(
      caller,
      collection,
      filterForCaller,
      conditionalTriggerRawCondition,
    );
  }

  private async doesTriggerCustomActionRequiresApproval(
    caller: Caller,
    customActionName: string,
    collection: Collection,
    filterForCaller: Filter,
  ): Promise<boolean> {
    const doesTriggerRequiresApproval =
      await this.forestAdminClient.permissionService.doesTriggerCustomActionRequiresApproval({
        userId: caller.id,
        customActionName,
        collectionName: collection.name,
      });

    if (!doesTriggerRequiresApproval) {
      return false;
    }

    const conditionalRequiresApprovalRawCondition =
      await this.forestAdminClient.permissionService.getConditionalRequiresApprovalCondition({
        userId: caller.id,
        customActionName,
        collectionName: collection.name,
      });

    if (conditionalRequiresApprovalRawCondition) {
      const matchingRecordsCount =
        await ActionAuthorizationService.aggregateCountConditionIntersection(
          caller,
          collection,
          filterForCaller,
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
    caller: Caller,
    customActionName: string,
    collection: Collection,
    filterForCaller: Filter,
    requesterId: number | string,
  ): Promise<boolean> {
    const canApprove = await this.forestAdminClient.permissionService.canApproveCustomAction({
      userId: caller.id,
      requesterId,
      customActionName,
      collectionName: collection.name,
    });

    if (!canApprove) {
      return false;
    }

    const conditionalApproveRawCondition =
      await this.forestAdminClient.permissionService.getConditionalApproveCondition({
        userId: caller.id,
        customActionName,
        collectionName: collection.name,
      });

    return ActionAuthorizationService.canPerformConditionalCustomAction(
      caller,
      collection,
      filterForCaller,
      conditionalApproveRawCondition,
    );
  }

  private async getRoleIdsAllowedToApprove(
    caller: Caller,
    customActionName: string,
    collection: Collection,
    filterForAllCaller: Filter,
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
        ActionAuthorizationService.aggregateCountConditionIntersection(
          caller,
          collection,
          filterForAllCaller,
        ),
        ...rolesIdsGroupByConditions.map(({ condition }) =>
          ActionAuthorizationService.aggregateCountConditionIntersection(
            caller,
            collection,
            filterForAllCaller,
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

  private static async canPerformConditionalCustomAction(
    caller: Caller,
    collection: Collection,
    requestFilter: Filter,
    condition?: unknown,
  ) {
    if (condition) {
      const [requestRecordsCount, matchingRecordsCount] = await Promise.all([
        ActionAuthorizationService.aggregateCountConditionIntersection(
          caller,
          collection,
          requestFilter,
        ),
        ActionAuthorizationService.aggregateCountConditionIntersection(
          caller,
          collection,
          requestFilter,
          condition,
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

  private static async aggregateCountConditionIntersection(
    caller: Caller,
    collection: Collection,
    requestFilter: Filter,
    condition?: unknown,
  ) {
    try {
      // Override request filter with condition if any
      const conditionalFilter = requestFilter.override({
        conditionTree: condition
          ? ConditionTreeFactory.intersect(
              ConditionTreeParser.fromPlainObject(collection, condition),
              requestFilter.conditionTree,
            )
          : requestFilter.conditionTree,
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

  /**
   * Given a map it groups keys based on their hash values
   * @param actionConditionsByRoleId
   * @returns
   */
  private static transformToRolesIdsGroupByConditions<T>(
    actionConditionsByRoleId?: Map<number, T>,
  ): {
    roleIds: number[];
    condition: T;
  }[] {
    if (!actionConditionsByRoleId) {
      return [];
    }

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
