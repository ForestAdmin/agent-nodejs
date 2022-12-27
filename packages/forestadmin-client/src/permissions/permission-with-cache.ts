import { Chart } from '../charts/types';
import { PermissionService } from '../types';
import ActionPermission from './action-permission';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './generate-action-identifier';
import RenderingPermissionService from './rendering-permission';
import { CollectionActionEvent, CustomActionEvent } from './types';

export default class PermissionServiceWithCache implements PermissionService {
  constructor(
    private readonly actionPermissionService: ActionPermission,
    private readonly renderingPermissionService: RenderingPermissionService,
  ) {}

  public async canOnCollection({
    userId,
    collectionName,
    event,
  }: {
    userId: number;
    event: CollectionActionEvent;
    collectionName: string;
  }): Promise<boolean> {
    const roleId = await this.getRoleIdForUserId(userId);

    return this.actionPermissionService.can(
      roleId,
      generateCollectionActionIdentifier(event, collectionName),
    );
  }

  public async canExecuteSegmentQuery(params: {
    userId: number;
    collectionName: string;
    renderingId: number;
    segmentQuery: string;
  }) {
    return this.renderingPermissionService.canExecuteSegmentQuery(params);
  }

  public async canTriggerCustomAction({
    userId,
    collectionName,
    customActionName,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
  }): Promise<boolean> {
    const roleId = await this.getRoleIdForUserId(userId);

    return this.actionPermissionService.can(
      roleId,
      generateCustomActionIdentifier(CustomActionEvent.Trigger, customActionName, collectionName),
    );
  }

  public async doesTriggerCustomActionRequiresApproval({
    userId,
    collectionName,
    customActionName,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
  }): Promise<boolean> {
    // In development everything is allowed (even RequireApproval)
    // but we don't want to require approvals!
    if (await this.actionPermissionService.isDevelopmentPermission()) {
      return false;
    }

    const roleId = await this.getRoleIdForUserId(userId);

    return this.actionPermissionService.can(
      roleId,
      generateCustomActionIdentifier(
        CustomActionEvent.RequireApproval,
        customActionName,
        collectionName,
      ),
    );
  }

  public async canApproveCustomAction({
    userId,
    collectionName,
    customActionName,
    requesterId,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
    requesterId: number;
  }): Promise<boolean> {
    const actionIdentifier =
      requesterId === userId
        ? generateCustomActionIdentifier(
            CustomActionEvent.SelfApprove,
            customActionName,
            collectionName,
          )
        : generateCustomActionIdentifier(
            CustomActionEvent.Approve,
            customActionName,
            collectionName,
          );

    const roleId = await this.getRoleIdForUserId(userId);

    return this.actionPermissionService.can(roleId, actionIdentifier);
  }

  public async getConditionalTriggerCondition({
    userId,
    collectionName,
    customActionName,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
  }) {
    const roleId = await this.getRoleIdForUserId(userId);

    return this.actionPermissionService.getCustomActionCondition(
      roleId,
      generateCustomActionIdentifier(CustomActionEvent.Trigger, customActionName, collectionName),
    );
  }

  public async getConditionalRequiresApprovalCondition({
    userId,
    collectionName,
    customActionName,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
  }) {
    const roleId = await this.getRoleIdForUserId(userId);

    return this.actionPermissionService.getCustomActionCondition(
      roleId,
      generateCustomActionIdentifier(
        CustomActionEvent.RequireApproval,
        customActionName,
        collectionName,
      ),
    );
  }

  public async getConditionalApproveCondition({
    userId,
    collectionName,
    customActionName,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
  }) {
    const roleId = await this.getRoleIdForUserId(userId);

    return this.actionPermissionService.getCustomActionCondition(
      roleId,
      generateCustomActionIdentifier(CustomActionEvent.Approve, customActionName, collectionName),
    );
  }

  public async getConditionalApproveConditions({
    collectionName,
    customActionName,
  }: {
    customActionName: string;
    collectionName: string;
  }) {
    return this.actionPermissionService.getAllCustomActionConditions(
      generateCustomActionIdentifier(CustomActionEvent.Approve, customActionName, collectionName),
    );
  }

  public async getRoleIdsAllowedToApproveWithoutConditions({
    collectionName,
    customActionName,
  }: {
    customActionName: string;
    collectionName: string;
  }) {
    return this.actionPermissionService.getRoleIdsAllowedToApproveWithoutConditions(
      generateCustomActionIdentifier(CustomActionEvent.Approve, customActionName, collectionName),
    );
  }

  public async canRequestCustomActionParameters({
    userId,
    collectionName,
    customActionName,
  }: {
    userId: number;
    collectionName: string;
    customActionName: string;
  }): Promise<boolean> {
    const roleId = await this.getRoleIdForUserId(userId);

    return this.actionPermissionService.can(
      roleId,
      generateCustomActionIdentifier(CustomActionEvent.Trigger, customActionName, collectionName),
    );
  }

  public async canExecuteChart({
    renderingId,
    userId,
    chartRequest,
  }: {
    renderingId: number;
    userId: number;
    chartRequest: Chart;
  }): Promise<boolean> {
    return this.renderingPermissionService.canExecuteChart({
      renderingId,
      userId,
      chartRequest,
    });
  }

  private async getRoleIdForUserId(userId: number) {
    return (await this.renderingPermissionService.getUser(userId))?.roleId;
  }
}
