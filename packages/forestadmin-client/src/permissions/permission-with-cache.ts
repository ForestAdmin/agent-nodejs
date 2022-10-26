import { CollectionActionEvent, CustomActionEvent } from './types';
import { PermissionService } from '../types';
import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './generate-action-identifier';
import ActionPermission from './action-permission';
import RenderingPermissionService from './rendering-permission';

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
    return this.actionPermissionService.can(
      `${userId}`,
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
    return this.actionPermissionService.can(
      `${userId}`,
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
    return this.actionPermissionService.can(
      `${userId}`,
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

    return this.actionPermissionService.can(`${userId}`, actionIdentifier);
  }

  public async getConditionalTriggerFilter({
    userId,
    collectionName,
    customActionName,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
  }) {
    return this.actionPermissionService.getCustomActionConditionForUser(
      `${userId}`,
      generateCustomActionIdentifier(CustomActionEvent.Trigger, customActionName, collectionName),
    );
  }

  public async getConditionalRequiresApprovalFilter({
    userId,
    collectionName,
    customActionName,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
  }) {
    return this.actionPermissionService.getCustomActionConditionForUser(
      `${userId}`,
      generateCustomActionIdentifier(
        CustomActionEvent.RequireApproval,
        customActionName,
        collectionName,
      ),
    );
  }

  public async getConditionalApproveFilter({
    userId,
    collectionName,
    customActionName,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
  }) {
    return this.actionPermissionService.getCustomActionConditionForUser(
      `${userId}`,
      generateCustomActionIdentifier(CustomActionEvent.Approve, customActionName, collectionName),
    );
  }

  public async getConditionalApproveFilters({
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

  public async canRequestCustomActionParameters({
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

  public async canRetrieveChart({
    renderingId,
    userId,
    chartRequest,
  }: {
    renderingId: number;
    userId: number;
    chartRequest: unknown;
  }): Promise<boolean> {
    return this.renderingPermissionService.canRetrieveChart({
      renderingId,
      userId,
      chartRequest,
    });
  }
}
