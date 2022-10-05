import { Context } from 'koa';

import { Collection, ConditionTree, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { CollectionActionEvent, SmartActionRequestBody } from '@forestadmin/forestadmin-client';

import { ForestAdminClient } from '../../types';

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

    if (!(await this.forestAdminClient.canOnCollection(userId, event, collectionName))) {
      context.throw(403, 'Forbidden');
    }
  }

  public async assertCanExecuteCustomActionAndReturnRequestBody(
    context: Context,
    customActionName: string,
    collectionName: string,
  ): Promise<SmartActionRequestBody> {
    const { id: userId } = context.state.user;

    const bodyOrFalse = await this.forestAdminClient.canExecuteCustomAction({
      userId,
      customActionName,
      collectionName,
      body: context.request.body,
    });

    if (!bodyOrFalse) {
      context.throw(403, 'Forbidden');
    }

    return bodyOrFalse as SmartActionRequestBody;
  }

  public async assertCanExecuteCustomActionHook(
    context: Context,
    customActionName: string,
    collectionName: string,
  ) {
    const { id: userId } = context.state.user;

    if (
      !(await this.forestAdminClient.canExecuteCustomActionHook({
        userId,
        customActionName,
        collectionName,
      }))
    ) {
      context.throw(403, 'Forbidden');
    }
  }

  public async getScope(collection: Collection, context: Context): Promise<ConditionTree> {
    const { user } = context.state;

    const scope = await this.forestAdminClient.getScope(user.renderingId, user, collection.name);

    if (!scope) return null;

    return ConditionTreeFactory.fromPlainObject(scope);
  }

  public async assertCanRetrieveChart(context: Context): Promise<void> {
    const { renderingId, id: userId } = context.state.user;
    const { body: chartRequest } = context.request;

    if (
      !(await this.forestAdminClient.canRetrieveChart({
        renderingId,
        userId,
        chartRequest,
      }))
    ) {
      context.throw(403, 'Forbidden');
    }
  }

  public invalidateScopeCache(renderingId: number) {
    this.forestAdminClient.markScopesAsUpdated(renderingId);
  }
}
