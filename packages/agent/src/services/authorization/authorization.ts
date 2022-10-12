import { Context } from 'koa';

import { Collection, ConditionTree } from '@forestadmin/datasource-toolkit';
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
  }: {
    context: Context;
    customActionName: string;
    collectionName: string;
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
