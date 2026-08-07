import { CollectionActionEvent } from '@forestadmin/forestadmin-client';

export { CollectionActionEvent };

export enum CustomActionEvent {
  Trigger = 'trigger',
  Approve = 'approve',
  SelfApprove = 'self-approve',
  RequireApproval = 'require-approval',
}

export function generateCustomActionIdentifier(
  actionEventName: CustomActionEvent,
  customActionName: string,
  collectionName: string,
): string {
  return `custom:${collectionName}:${customActionName}:${actionEventName}`;
}

export function generateCollectionActionIdentifier(
  action: CollectionActionEvent,
  collectionName: string,
): string {
  return `collection:${collectionName}:${action}`;
}
