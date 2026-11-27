import type {
  ActionPermissions,
  CollectionActionEvent,
  CustomActionEvent,
} from '@forestadmin/forestadmin-client';

import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
  isActionAllowedForRole,
} from '@forestadmin/forestadmin-client';

export function canRolePerformCollectionAction(
  permissions: ActionPermissions,
  roleId: number,
  action: CollectionActionEvent,
  collectionName: string,
): boolean {
  return isActionAllowedForRole(
    permissions,
    roleId,
    generateCollectionActionIdentifier(action, collectionName),
  );
}

export interface CanRolePerformCustomActionParams {
  permissions: ActionPermissions;
  roleId: number;
  event: CustomActionEvent;
  actionName: string;
  collectionName: string;
}

export function canRolePerformCustomAction({
  permissions,
  roleId,
  event,
  actionName,
  collectionName,
}: CanRolePerformCustomActionParams): boolean {
  return isActionAllowedForRole(
    permissions,
    roleId,
    generateCustomActionIdentifier(event, actionName, collectionName),
  );
}
