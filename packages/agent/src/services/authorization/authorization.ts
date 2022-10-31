import { Context } from 'koa';

import {
  Aggregation,
  Caller,
  Collection,
  ConditionTree,
  ConditionTreeFactory,
  Filter,
  GenericTree,
} from '@forestadmin/datasource-toolkit';
import { CollectionActionEvent, ForestAdminClient } from '@forestadmin/forestadmin-client';

import { HttpCode } from '../../types';
import ApprovalNotAllowedError from './errors/approvalNotAllowedError';
import ConditionTreeParser from '../../utils/condition-tree-parser';
import CustomActionRequiresApprovalError from './errors/CustomActionRequiresApprovalError';
import CustomActionTriggerForbiddenError from './errors/customActionTriggerForbiddenError';
import InvalidActionConditionError from './errors/invalidActionConditionError';

type CanApproveCustomActionParams = {
  context: Context;
  customActionName: string;
  collection: Collection;
  requestConditionTreeForCaller: ConditionTree;
  requestConditionTreeForAllCaller: ConditionTree;
  caller: Caller;
};

export default class AuthorizationService {
  constructor(private readonly forestAdminClient: ForestAdminClient) {}

  public async assertCanBrowse(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Browse, context, collectionName);
  }

  public async assertCanRead(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Read, context, collectionName);
  }

  public async assertCanAdd(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Add, context, collectionName);
  }

  public async assertCanEdit(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Edit, context, collectionName);
  }

  public async assertCanDelete(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Delete, context, collectionName);
  }

  public async assertCanExport(context: Context, collectionName: string) {
    await this.assertCanOnCollection(CollectionActionEvent.Export, context, collectionName);
  }

  private async assertCanOnCollection(
    event: CollectionActionEvent,
    context: Context,
    collectionName: string,
  ) {
    const { id: userId } = context.state.user;

    const canOnCollection = await this.forestAdminClient.permissionService.canOnCollection({
      userId,
      event,
      collectionName,
    });

    if (!canOnCollection) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
    }
  }

  public async assertCanTriggerCustomAction({
    context,
    customActionName,
    collection,
    requestConditionTreeForCaller,
    requestConditionTreeForAllCaller,
    caller,
  }: CanApproveCustomActionParams): Promise<void> {
    const { id: userId } = context.state.user;

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
      const rolesIdsAllowedToApprove = await this.getRolesIdsAllowedToApprove(
        caller,
        customActionName,
        collection,
        requestConditionTreeForAllCaller,
      );

      throw new CustomActionRequiresApprovalError(rolesIdsAllowedToApprove);
    }
  }

  public async assertCanApproveCustomAction({
    context,
    customActionName,
    requesterId,
    collection,
    requestConditionTreeForCaller,
    requestConditionTreeForAllCaller,
    caller,
  }: CanApproveCustomActionParams & {
    requesterId: number | string;
  }): Promise<void> {
    const { id: userId } = context.state.user;
    const canApprove = await this.canApproveCustomAction(
      userId,
      customActionName,
      collection,
      requestConditionTreeForCaller,
      caller,
      requesterId,
    );

    if (!canApprove) {
      const rolesIdsAllowedToApprove = await this.getRolesIdsAllowedToApprove(
        caller,
        customActionName,
        collection,
        requestConditionTreeForAllCaller,
      );

      throw new ApprovalNotAllowedError(rolesIdsAllowedToApprove);
    }
  }

  public async assertCanRequestCustomActionParameters(
    context: Context,
    customActionName: string,
    collectionName: string,
  ) {
    const { id: userId } = context.state.user;

    const canRequest =
      await this.forestAdminClient.permissionService.canRequestCustomActionParameters({
        userId,
        customActionName,
        collectionName,
      });

    if (!canRequest) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
    }
  }

  public async assertCanRetrieveChart(context: Context): Promise<void> {
    const { renderingId, id: userId } = context.state.user;
    const { body: chartRequest } = context.request;

    const canRetrieve = await this.forestAdminClient.permissionService.canRetrieveChart({
      renderingId,
      userId,
      chartRequest,
    });

    if (!canRetrieve) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
    }
  }

  public async getScope(collection: Collection, context: Context): Promise<ConditionTree> {
    const { user } = context.state;

    const scope = await this.forestAdminClient.getScope({
      renderingId: user.renderingId,
      userId: user.id,
      collectionName: collection.name,
    });

    if (!scope) return null;

    return ConditionTreeParser.fromPlainObject(collection, scope);
  }

  public invalidateScopeCache(renderingId: number | string) {
    this.forestAdminClient.markScopesAsUpdated(renderingId);
  }

  public verifySignedActionParameters<TSignedParameters>(signedToken: string): TSignedParameters {
    return this.forestAdminClient.verifySignedActionParameters(signedToken);
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

    const conditionalTriggerRawFilter =
      await this.forestAdminClient.permissionService.getConditionalTriggerFilter({
        userId,
        customActionName,
        collectionName: collection.name,
      });

    return this.canPerformConditionalCustomAction(
      caller,
      collection,
      requestConditionTreeForCaller,
      conditionalTriggerRawFilter,
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

    const conditionalRequiresApprovalRawFilter =
      await this.forestAdminClient.permissionService.getConditionalRequiresApprovalFilter({
        userId,
        customActionName,
        collectionName: collection.name,
      });

    if (conditionalRequiresApprovalRawFilter) {
      const matchingRecordsCount = await this.intersectAggregate(
        caller,
        collection,
        requestConditionTreeForCaller,
        conditionalRequiresApprovalRawFilter,
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

    const conditionalApproveRawFilter =
      await this.forestAdminClient.permissionService.getConditionalApproveFilter({
        userId,
        customActionName,
        collectionName: collection.name,
      });

    return this.canPerformConditionalCustomAction(
      caller,
      collection,
      requestConditionTreeForCaller,
      conditionalApproveRawFilter,
    );
  }

  private async canPerformConditionalCustomAction(
    caller: Caller,
    collection: Collection,
    requestConditionTree: ConditionTree,
    conditionalRawFilter: GenericTree,
  ) {
    if (conditionalRawFilter) {
      const [requestRecordsCount, matchingRecordsCount] = await Promise.all([
        this.intersectAggregate(caller, collection, requestConditionTree),
        this.intersectAggregate(caller, collection, requestConditionTree, conditionalRawFilter),
      ]);

      // If some records don't match the condition then the user
      // is not allow to perform the conditional action
      if (matchingRecordsCount !== requestRecordsCount) {
        return false;
      }
    }

    return true;
  }

  private async getRolesIdsAllowedToApprove(
    caller: Caller,
    customActionName: string,
    collection: Collection,
    requestConditionTreeForAllCaller: ConditionTree,
  ) {
    const rolesIdsGroupByConditions =
      await this.forestAdminClient.permissionService.getConditionalApproveFilters({
        customActionName,
        collectionName: collection.name,
      });

    const [requestRecordsCount, ...conditionRecordsCounts]: number[] = await Promise.all([
      this.intersectAggregate(caller, collection, requestConditionTreeForAllCaller),
      ...rolesIdsGroupByConditions.map(({ filterGenericTree }) =>
        this.intersectAggregate(
          caller,
          collection,
          requestConditionTreeForAllCaller,
          filterGenericTree,
        ),
      ),
    ]);

    return rolesIdsGroupByConditions.reduce(
      (rolesIdsAllowedToApprove, { roleIds }, currentIndex) => {
        if (requestRecordsCount === conditionRecordsCounts[currentIndex]) {
          rolesIdsAllowedToApprove.push(...roleIds);
        }

        return rolesIdsAllowedToApprove;
      },
      [],
    );
  }

  private async intersectAggregate(
    caller: Caller,
    collection: Collection,
    requestConditionTree: ConditionTree,
    conditionalRawFilter?: GenericTree,
  ) {
    try {
      // Build filter format with the right format
      const conditionalFilter = new Filter({
        conditionTree: conditionalRawFilter
          ? ConditionTreeFactory.intersect(
              ConditionTreeParser.fromPlainObject(collection, conditionalRawFilter),
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
}
