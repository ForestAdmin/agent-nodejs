import { Context } from 'koa';

import { Collection, ConditionTree, ConditionTreeFactory } from '@forestadmin/datasource-toolkit';

import { AgentOptionsWithDefaults } from '../../types';
import { CollectionActionEvent, CustomActionEvent } from './internal/types';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './internal/generate-action-identifier';
import ActionPermissionService from './internal/action-permission';
import RenderingPermissionService from './internal/rendering-permission';
import verifyAndExtractApproval from './internal/verify-approval';

export type AuthorizationServiceOptions = Pick<AgentOptionsWithDefaults, 'envSecret'>;

export default class AuthorizationService {
  constructor(
    private readonly actionPermissionService: ActionPermissionService,
    private readonly renderingPermissionService: RenderingPermissionService,
    private readonly options: AuthorizationServiceOptions,
  ) {}

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
    const {
      body: {
        data: {
          attributes: { requester_id: approvalRequesterId } = { requester_id: null },
          type = 'custom-action-trigger',
        } = {},
      } = {},
    } = context.request;

    let customActionEvenType = CustomActionEvent.Trigger;

    if (type === 'custom-action-requests') {
      customActionEvenType =
        approvalRequesterId === context.state.user.id
          ? CustomActionEvent.SelfApprove
          : CustomActionEvent.Approve;
    }

    if (
      !(await this.actionPermissionService.can(
        `${userId}`,
        generateCustomActionIdentifier(customActionEvenType, customActionName, collectionName),
      ))
    ) {
      context.throw(403, 'Forbidden');
    }
  }

  public getApprovalRequestData(context: Context) {
    const {
      body: {
        data: {
          attributes: { signed_approval_request: signedApprovalRequest } = {
            signed_approval_request: null,
          },
        } = {},
      } = {},
    } = context.request;

    if (signedApprovalRequest) {
      return verifyAndExtractApproval(signedApprovalRequest, this.options.envSecret);
    }

    return null;
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
