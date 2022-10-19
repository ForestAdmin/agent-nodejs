import { CollectionActionEvent, CustomActionEvent, GenericTreeWithSources } from './types';
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
    customActionConfiguration,
    conditionSolver,
  }: {
    userId: number;
    customActionName: string;
    collectionName: string;
    customActionConfiguration: { ids: number[] };
    conditionSolver: (filter: GenericTreeWithSources) => Promise<number[]>;
  }): Promise<boolean> {
    // ===== TRIGGER STAGE
    // LOGIC: check that the user can Trigger
    const canTrigger = await this.actionPermissionService.can(
      `${userId}`,
      generateCustomActionIdentifier(CustomActionEvent.Trigger, customActionName, collectionName),
    );

    // CASE: User not allow to trigger the action TriggerForbidden
    if (!canTrigger) {
      throw new Error('CustomActionTriggerForbiddenError');
    }

    const conditionalTriggerFilter = await this.actionPermissionService.getCustomActionCondition(
      `${userId}`,
      generateCustomActionIdentifier(CustomActionEvent.Trigger, customActionName, collectionName),
    );

    if (conditionalTriggerFilter) {
      // LOGIC: check that the user can Trigger with condition filter if any
      // try conditionSolver catch throw new Error('InvalidActionConditionError');
      const matchingRecordsIdsWithConditionFilter = await conditionSolver(conditionalTriggerFilter);

      // CASE: Condition partially respected -> CustomAction TriggerForbidden
      // if some records don't match the condition the user is not allow to perform the action
      if (
        customActionConfiguration.ids.some(
          recordIdMatchingCondition =>
            !matchingRecordsIdsWithConditionFilter.includes(recordIdMatchingCondition),
        )
      ) {
        throw new Error('CustomActionTriggerForbiddenError');
      }
    }

    // LOGIC: Is OK let see approval

    // ===== TRIGGER REQUIRES APPROVAL STAGE

    const doesTriggerRequireApproval = await this.actionPermissionService.can(
      `${userId}`,
      generateCustomActionIdentifier(
        CustomActionEvent.RequireApproval,
        customActionName,
        collectionName,
      ),
    );

    // CASE: User can trigger without approval required -> true
    if (!doesTriggerRequireApproval) {
      return true;
    }

    const conditionalRequireApprovalFilter =
      await this.actionPermissionService.getCustomActionCondition(
        `${userId}`,
        generateCustomActionIdentifier(
          CustomActionEvent.RequireApproval,
          customActionName,
          collectionName,
        ),
      );

    if (conditionalRequireApprovalFilter) {
      // LOGIC: check that the user need to RequireApproval with condition filter if any
      // try conditionSolver catch throw new Error('InvalidActionConditionError');
      const matchingRecordsIdsWithConditionFilter = await conditionSolver(
        conditionalRequireApprovalFilter,
      );

      // CASE: Condition partially respected -> CustomAction RequiresApproval
      // if at least some records match the condition
      if (
        customActionConfiguration.ids.some(recordIdMatchingCondition =>
          matchingRecordsIdsWithConditionFilter.includes(recordIdMatchingCondition),
        )
      ) {
        throw new Error('CustomActionRequiresApprovalError');
      }

      // CASE: No records match the condition -> User can trigger without approval
      return true;
    }

    // CASE: No conditionalRequireApprovalFilter -> CustomAction always RequiresApproval
    throw new Error('CustomActionRequiresApprovalError');
  }

  public canApproveCustomAction({
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

    // TODO: Use the same logic as canTriggerCustomAction
    // Approve and SelfApprove share conditions into
    // getCustomActionCondition(... CustomActionEvent.Approve ...)

    // CASE: Cannot do actionIdentifier -> ApprovalNotAllowedError
    // + compute rolesIdsAllowedToApprove somehow

    // CASE: Some records don't match the condition -> ApprovalNotAllowedError
    // + compute rolesIdsAllowedToApprove somehow

    // CASE: All records match the condition -> User can approve

    return this.actionPermissionService.can(`${userId}`, actionIdentifier);
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
    // QUESTION: Trigger should be enough ? (no need to perform extra work for conditional here)
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
