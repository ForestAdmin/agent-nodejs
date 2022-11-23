import {
  Caller,
  Collection,
  ConditionTree,
  UnprocessableError,
} from '@forestadmin/datasource-toolkit';
import {
  ChainedSQLQueryError,
  CollectionActionEvent,
  EmptySQLQueryError,
  ForestAdminClient,
  NonSelectSQLQueryError,
} from '@forestadmin/forestadmin-client';
import { Context } from 'koa';

import { HttpCode } from '../../types';
import ConditionTreeParser from '../../utils/condition-tree-parser';
import ActionAuthorizationService from './action-authorization';

type CanPerformCustomActionParams = {
  context: Context;
  customActionName: string;
  collection: Collection;
  requestConditionTreeForCaller: ConditionTree;
  requestConditionTreeForAllCaller: ConditionTree;
  caller: Caller;
};

export default class AuthorizationService {
  private actionAuthorizationService: ActionAuthorizationService;

  constructor(private readonly forestAdminClient: ForestAdminClient) {
    this.actionAuthorizationService = new ActionAuthorizationService(forestAdminClient);
  }

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
  }: CanPerformCustomActionParams): Promise<void> {
    const { id: userId } = context.state.user;

    return this.actionAuthorizationService.assertCanTriggerCustomAction({
      userId,
      customActionName,
      collection,
      requestConditionTreeForCaller,
      requestConditionTreeForAllCaller,
      caller,
    });
  }

  public async assertCanApproveCustomAction({
    context,
    customActionName,
    requesterId,
    collection,
    requestConditionTreeForCaller,
    requestConditionTreeForAllCaller,
    caller,
  }: CanPerformCustomActionParams & {
    requesterId: number | string;
  }): Promise<void> {
    const { id: userId } = context.state.user;

    return this.actionAuthorizationService.assertCanApproveCustomAction({
      userId,
      customActionName,
      requesterId,
      collection,
      requestConditionTreeForCaller,
      requestConditionTreeForAllCaller,
      caller,
    });
  }

  public async assertCanRequestCustomActionParameters(
    context: Context,
    customActionName: string,
    collectionName: string,
  ) {
    const { id: userId } = context.state.user;

    return this.actionAuthorizationService.assertCanRequestCustomActionParameters(
      userId,
      customActionName,
      collectionName,
    );
  }

  public async assertCanExecuteChart(context: Context): Promise<void> {
    const { renderingId, id: userId } = context.state.user;
    const { body: chartRequest } = context.request;

    try {
      const canRetrieve = await this.forestAdminClient.permissionService.canExecuteChart({
        renderingId,
        userId,
        chartRequest,
      });

      if (!canRetrieve) {
        context.throw(HttpCode.Forbidden, 'Forbidden');
      }
    } catch (error) {
      if (
        error instanceof EmptySQLQueryError ||
        error instanceof ChainedSQLQueryError ||
        error instanceof NonSelectSQLQueryError
      ) {
        throw new UnprocessableError(error.message);
      }

      throw error;
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
