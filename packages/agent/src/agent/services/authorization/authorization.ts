import { Context } from 'koa';

import { Collection, ConditionTree, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';
import { CollectionActionEvent, CustomActionEvent } from './internal/types';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './internal/generate-action-identifier';
import ActionPermissionService from './internal/action-permission';
import RenderingPermissionService from './internal/rendering-permission';

export default class AuthorizationService {
  constructor(
    private readonly actionPermissionService: ActionPermissionService,
    private readonly renderingPermissionService: RenderingPermissionService,
  ) {}

  public async assertCanOnCollection(
    context: Context,
    event: CollectionActionEvent,
    collectionName: string,
  ) {
    const { id: userId, renderingId } = context.state.user;

    if (
      !(await this.actionPermissionService.can({
        userId: `${userId}`,
        renderingId: `${renderingId}`,
        actionName: generateCollectionActionIdentifier(event, collectionName),
      }))
    ) {
      context.throw(403, 'Forbidden');
    }
  }

  public async assertCanExecuteCustomAction(
    context: Context,
    customActionName: string,
    collectionName: string,
  ) {
    const { id: userId, renderingId } = context.state.user;

    if (
      !(await this.actionPermissionService.canOneOf({
        userId: `${userId}`,
        renderingId: `${renderingId}`,
        actionNames: [
          generateCustomActionIdentifier(
            CustomActionEvent.Trigger,
            customActionName,
            collectionName,
          ),
          generateCustomActionIdentifier(
            CustomActionEvent.Approve,
            customActionName,
            collectionName,
          ),
          generateCustomActionIdentifier(
            CustomActionEvent.SelfApprove,
            customActionName,
            collectionName,
          ),
        ],
      }))
    ) {
      context.throw(403, 'Forbidden');
    }
  }

  async getScope(collection: Collection, context: Context): Promise<ConditionTree> {
    const { user } = context.state;

    const scope = await this.renderingPermissionService.getScope({
      renderingId: user.renderingId,
      collectionName: collection.name,
      user,
    });

    if (!scope) return null;

    return ConditionTreeFactory.fromPlainObject(scope);
  }

  async assertCanRetrieveChart(context: Context): Promise<void> {
    const { renderingId, id: userId } = context.state.user;
    const { body: chartRequest } = context.request;

    if (
      !(await this.renderingPermissionService.canRetrieveChart({
        renderingId,
        userId,
        chartRequest,
      }))
    ) {
      context.throw(403, 'Forbidden');
    }
  }

  public invalidateScopeCache(renderingId: number) {
    this.renderingPermissionService.invalidateCache(renderingId);
  }
}
