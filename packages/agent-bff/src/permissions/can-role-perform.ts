import type {
  ActionPermissions,
  CollectionActionEvent,
  CustomActionEvent,
} from '@forestadmin/forestadmin-client';

import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from '@forestadmin/forestadmin-client';

export function isActionIdentifierAllowedForRole(
  permissions: ActionPermissions,
  roleId: number,
  actionName: string,
): boolean {
  return Boolean(
    permissions.isDevelopment ||
      permissions.actionsGloballyAllowed.has(actionName) ||
      permissions.actionsByRole.get(actionName)?.allowedRoles.has(roleId),
  );
}

export function canRolePerformCollectionAction(
  permissions: ActionPermissions,
  roleId: number,
  action: CollectionActionEvent,
  collectionName: string,
): boolean {
  return isActionIdentifierAllowedForRole(
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
  return isActionIdentifierAllowedForRole(
    permissions,
    roleId,
    generateCustomActionIdentifier(event, actionName, collectionName),
  );
}
