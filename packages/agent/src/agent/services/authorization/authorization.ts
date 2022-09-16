import { Context } from 'koa';

import { CollectionActionEvent, CustomActionEvent } from './internal/types';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './internal/generate-action-identifier';
import ActionPermissionService from './internal/action-permission';

export default class AuthorizationService {
  constructor(private readonly actionPermissionService: ActionPermissionService) {}

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
}
