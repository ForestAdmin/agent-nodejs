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
import ConditionTreeParser from '../../utils/condition-tree-parser';

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
    collectionName,
    collectionAggregate,
    requestConditionTree,
    caller,
  }: {
    context: Context;
    customActionName: string;
    collectionName: string;
    collectionAggregate: Collection['aggregate'];
    requestConditionTree: ConditionTree;
    caller: Caller;
  }): Promise<void> {
    const { id: userId } = context.state.user;
    const canTrigger = await this.forestAdminClient.permissionService.canTriggerCustomAction({
      userId,
      customActionName,
      collectionName,
    });

    if (!canTrigger) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
    }

    const preBakedIntersectAggregate = async (conditionalTriggerRawFilter?: GenericTree) => {
      // Build filter format with the right format
      const conditionalConditionTree = ConditionTreeFactory.fromPlainObject(
        conditionalTriggerRawFilter,
      );

      const conditionalFilter = new Filter({
        conditionTree: ConditionTreeFactory.intersect(
          conditionalConditionTree,
          requestConditionTree,
        ),
      });

      const rows = collectionAggregate(
        caller,
        conditionalFilter,
        new Aggregation({
          operation: 'Count',
        }),
      );

      return (rows?.[0]?.value as number) ?? 0;
    };

    // Can be promisify to only compute if needed
    const requestRecordsCount = await preBakedIntersectAggregate();

    // Checking conditional trigger filter
    const conditionalTriggerRawFilter =
      await this.forestAdminClient.permissionService.getConditionalTriggerFilter({
        userId,
        customActionName,
        collectionName,
      });

    if (conditionalTriggerRawFilter) {
      // preBakedIntersectAggregate should embed this code internally
      // try {
      // } catch (e) {
      //   context.throw(HttpCode.Unprocessable, 'InvalidActionConditionError');
      // }
      const matchingRecordsCount = await preBakedIntersectAggregate(conditionalTriggerRawFilter);

      // CASE: Condition partially respected -> CustomAction TriggerForbidden
      // if some records don't match the condition the user is not allow to perform the action
      if (matchingRecordsCount !== requestRecordsCount) {
        throw new Error('CustomActionTriggerForbiddenError');
      }
    }

    // STATE: Trigger is OK let see if requires approval

    const doesTriggerRequiresApproval =
      await await this.forestAdminClient.permissionService.doesTriggerCustomActionRequiresApproval({
        userId,
        customActionName,
        collectionName,
      });

    // CASE: User can trigger without approval required -> return
    if (!doesTriggerRequiresApproval) {
      return;
    }

    // Checking conditional Requires Approval filter
    const conditionalRequiresApprovalRawFilter =
      await this.forestAdminClient.permissionService.getConditionalRequiresApprovalFilter({
        userId,
        customActionName,
        collectionName,
      });

    if (conditionalRequiresApprovalRawFilter) {
      const matchingRecordsCount = await preBakedIntersectAggregate(
        conditionalRequiresApprovalRawFilter,
      );

      // CASE: No records match the condition -> User can trigger without approval -> return
      if (matchingRecordsCount === 0) {
        return;
      }
    }

    // CASE: Some records respect the condition -> CustomAction RequiresApproval
    // OR CASE: No conditionalRequireApprovalFilter -> CustomAction always RequiresApproval
    throw new Error('CustomActionTriggerForbiddenError');
  }

  public async assertCanApproveCustomAction({
    context,
    customActionName,
    collectionName,
    requesterId,
  }: {
    context: Context;
    customActionName: string;
    collectionName: string;
    requesterId: number | string;
  }): Promise<void> {
    const { id: userId } = context.state.user;
    const canApprove = await this.forestAdminClient.permissionService.canApproveCustomAction({
      userId,
      customActionName,
      collectionName,
      requesterId,
    });

    if (!canApprove) {
      context.throw(HttpCode.Forbidden, 'Forbidden');
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
}
