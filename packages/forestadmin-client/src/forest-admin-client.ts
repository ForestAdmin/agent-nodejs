import {
  CollectionActionEvent,
  CustomActionEvent,
  GenericTree,
  SmartActionApprovalRequestBody,
  SmartActionRequestBody,
  User,
} from './permissions/types';

import { ForestAdminClientOptionsWithDefaults } from './types';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './permissions/generate-action-identifier';
import ActionPermissionService from './permissions/action-permission';
import RenderingPermissionService from './permissions/rendering-permission';
import verifyAndExtractApproval from './permissions/verify-approval';

export default class ForestAdminClient {
  constructor(
    protected readonly options: ForestAdminClientOptionsWithDefaults,
    protected readonly actionPermissionService: ActionPermissionService,
    protected readonly renderingPermissionService: RenderingPermissionService,
  ) {}

  public async canOnCollection(
    userId: number,
    event: CollectionActionEvent,
    collectionName: string,
  ): Promise<boolean> {
    return this.actionPermissionService.can(
      `${userId}`,
      generateCollectionActionIdentifier(event, collectionName),
    );
  }

  public async canExecuteCustomAction({
    userId,
    customActionName,
    collectionName,
    body,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
    body: SmartActionRequestBody | SmartActionApprovalRequestBody;
  }): Promise<false | SmartActionRequestBody> {
    let customActionEvenType = CustomActionEvent.Trigger;
    const approvalSignedParameters = this.getApprovalRequestData(
      body as SmartActionApprovalRequestBody,
    );

    if (approvalSignedParameters) {
      const approvalRequesterId = approvalSignedParameters?.data?.attributes?.requester_id;

      customActionEvenType =
        `${approvalRequesterId}` === `${userId}`
          ? CustomActionEvent.SelfApprove
          : CustomActionEvent.Approve;
    }

    if (
      await this.actionPermissionService.can(
        `${userId}`,
        generateCustomActionIdentifier(customActionEvenType, customActionName, collectionName),
      )
    ) {
      return approvalSignedParameters || body;
    }

    return false;
  }

  public async canExecuteCustomActionHook({
    userId,
    collectionName,
    customActionName,
  }: {
    userId: number;
    collectionName: string;
    customActionName: string;
  }): Promise<boolean> {
    return this.actionPermissionService.canOneOf(`${userId}`, [
      generateCustomActionIdentifier(CustomActionEvent.Trigger, customActionName, collectionName),
      generateCustomActionIdentifier(
        CustomActionEvent.RequireApproval,
        customActionName,
        collectionName,
      ),
    ]);
  }

  private getApprovalRequestData(
    body: SmartActionApprovalRequestBody,
  ): SmartActionRequestBody | null {
    const signedApprovalRequest = body?.data?.attributes?.signed_approval_request;

    if (signedApprovalRequest) {
      return verifyAndExtractApproval(signedApprovalRequest, this.options.envSecret);
    }

    return null;
  }

  async getScope(renderingId: number, user: User, collectionName: string): Promise<GenericTree> {
    return this.renderingPermissionService.getScope({
      renderingId,
      collectionName,
      user,
    });
  }

  async canRetrieveChart({
    renderingId,
    userId,
    chartRequest,
  }: {
    renderingId: number;
    userId: number;
    chartRequest: SmartActionApprovalRequestBody | SmartActionRequestBody;
  }): Promise<boolean> {
    return this.renderingPermissionService.canRetrieveChart({
      renderingId,
      userId,
      chartRequest,
    });
  }

  public markScopesAsUpdated(renderingId: number) {
    this.renderingPermissionService.invalidateCache(renderingId);
  }
}
