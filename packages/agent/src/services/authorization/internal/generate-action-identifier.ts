import { CollectionActionEvent, CustomActionEvent } from './types';

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
