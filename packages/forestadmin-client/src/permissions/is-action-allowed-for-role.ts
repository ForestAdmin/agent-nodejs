import type { ActionPermissions } from './generate-actions-from-permissions';

export default function isActionAllowedForRole(
  permissions: ActionPermissions,
  roleId: number,
  actionIdentifier: string,
): boolean {
  return Boolean(
    permissions.isDevelopment ||
      permissions.actionsGloballyAllowed.has(actionIdentifier) ||
      permissions.actionsByRole.get(actionIdentifier)?.allowedRoles.has(roleId),
  );
}
