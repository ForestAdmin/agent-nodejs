import { Context } from 'koa';

import { CollectionActionEvent, CustomActionEvent } from './internal/types';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './internal/generate-action-identifier';
import ActionPermissionService from './internal/action-permission';

export default class AuthorizationService {
  constructor(private readonly actionPermissionService: ActionPermissionService) {}

  public async assertCanBrowse(context: Context, collectionName: string) {
    await this.assertCanOnCollection(context, CollectionActionEvent.Browse, collectionName);
  }

  public async assertCanRead(context: Context, collectionName: string) {
    await this.assertCanOnCollection(context, CollectionActionEvent.Read, collectionName);
  }

  public async assertCanAdd(context: Context, collectionName: string) {
    await this.assertCanOnCollection(context, CollectionActionEvent.Add, collectionName);
  }

  public async assertCanEdit(context: Context, collectionName: string) {
    await this.assertCanOnCollection(context, CollectionActionEvent.Edit, collectionName);
  }

  public async assertCanDelete(context: Context, collectionName: string) {
    await this.assertCanOnCollection(context, CollectionActionEvent.Delete, collectionName);
  }

  public async assertCanExport(context: Context, collectionName: string) {
    await this.assertCanOnCollection(context, CollectionActionEvent.Export, collectionName);
  }

  private async assertCanOnCollection(
    context: Context,
    event: CollectionActionEvent,
    collectionName: string,
  ) {
    const { id: userId } = context.state.user;

    if (
      !(await this.actionPermissionService.can(
        `${userId}`,
        generateCollectionActionIdentifier(event, collectionName),
      ))
    ) {
      context.throw(403, 'Forbidden');
    }
  }

  public async assertCanExecuteCustomAction(
    context: Context,
    customActionName: string,
    collectionName: string,
  ) {
    const { id: userId } = context.state.user;

    if (
      !(await this.actionPermissionService.canOneOf(`${userId}`, [
        generateCustomActionIdentifier(CustomActionEvent.Trigger, customActionName, collectionName),
        generateCustomActionIdentifier(CustomActionEvent.Approve, customActionName, collectionName),
        generateCustomActionIdentifier(
          CustomActionEvent.SelfApprove,
          customActionName,
          collectionName,
        ),
      ]))
    ) {
      context.throw(403, 'Forbidden');
    }
  }
}
