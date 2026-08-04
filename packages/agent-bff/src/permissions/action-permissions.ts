import type { EnvironmentPermissionsV4, RawTreeWithSources } from '@forestadmin/forestadmin-client';

import {
  CollectionActionEvent,
  CustomActionEvent,
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './action-identifiers';

type RightDescriptionWithRolesV4 = { roles: number[] };
type RightDescriptionV4 = boolean | RightDescriptionWithRolesV4;

type RightConditionByRolesV4 = {
  roleId: number;
  filter: RawTreeWithSources;
};

type EnvironmentCollectionsPermissionsV4 = Exclude<EnvironmentPermissionsV4, true>['collections'];

type EnvironmentCollectionActionPermissionsV4 =
  EnvironmentCollectionsPermissionsV4[string]['actions'];

export type ActionPermission = {
  allowedRoles: Set<number>;
  conditionsByRole?: Map<number, RawTreeWithSources>;
};

export type ActionPermissions = {
  isDevelopment: boolean;
  actionsGloballyAllowed: Set<string>;
  actionsByRole: Map<string, ActionPermission>;
};

type IntermediateRightsList = {
  [key: string]: {
    description: RightDescriptionV4;
    conditions?: RightConditionByRolesV4[];
  };
};

function buildCollectionRights(
  permissions: EnvironmentCollectionsPermissionsV4,
): IntermediateRightsList {
  return Object.entries(permissions).reduce((acc, [collectionId, collectionPermissions]) => {
    const { collection } = collectionPermissions;

    return {
      ...acc,
      [generateCollectionActionIdentifier(CollectionActionEvent.Browse, collectionId)]: {
        description: collection.browseEnabled,
      },
      [generateCollectionActionIdentifier(CollectionActionEvent.Read, collectionId)]: {
        description: collection.readEnabled,
      },
      [generateCollectionActionIdentifier(CollectionActionEvent.Edit, collectionId)]: {
        description: collection.editEnabled,
      },
      [generateCollectionActionIdentifier(CollectionActionEvent.Add, collectionId)]: {
        description: collection.addEnabled,
      },
      [generateCollectionActionIdentifier(CollectionActionEvent.Delete, collectionId)]: {
        description: collection.deleteEnabled,
      },
      [generateCollectionActionIdentifier(CollectionActionEvent.Export, collectionId)]: {
        description: collection.exportEnabled,
      },
    };
  }, {});
}

function buildCustomActionRights(
  collectionId: string,
  actions: EnvironmentCollectionActionPermissionsV4,
): IntermediateRightsList {
  return Object.entries(actions).reduce(
    (acc, [actionName, actionPermissions]) => ({
      ...acc,
      [generateCustomActionIdentifier(CustomActionEvent.Approve, actionName, collectionId)]: {
        description: actionPermissions.userApprovalEnabled,
        conditions: actionPermissions.userApprovalConditions,
      },
      [generateCustomActionIdentifier(CustomActionEvent.SelfApprove, actionName, collectionId)]: {
        description: actionPermissions.selfApprovalEnabled,
      },
      [generateCustomActionIdentifier(CustomActionEvent.Trigger, actionName, collectionId)]: {
        description: actionPermissions.triggerEnabled,
        conditions: actionPermissions.triggerConditions,
      },
      [generateCustomActionIdentifier(CustomActionEvent.RequireApproval, actionName, collectionId)]:
        {
          description: actionPermissions.approvalRequired,
          conditions: actionPermissions.approvalRequiredConditions,
        },
    }),
    {},
  );
}

function buildActionRights(
  permissions: EnvironmentCollectionsPermissionsV4,
): IntermediateRightsList {
  return Object.entries(permissions).reduce(
    (acc, [collectionId, collectionPermissions]) => ({
      ...acc,
      ...buildCustomActionRights(collectionId, collectionPermissions.actions),
    }),
    {},
  );
}

function collectGloballyAllowed(rights: IntermediateRightsList): Set<string> {
  return new Set(
    Object.entries(rights)
      .filter(([, right]) => right.description === true)
      .map(([action]) => action),
  );
}

function collectByRole(rights: IntermediateRightsList): Map<string, ActionPermission> {
  return new Map(
    Object.entries(rights)
      .filter(([, right]) => typeof right.description !== 'boolean')
      .map(([name, right]) => [
        name,
        {
          allowedRoles: new Set((right.description as RightDescriptionWithRolesV4).roles),
          ...(right.conditions
            ? {
                conditionsByRole: new Map(
                  right.conditions.map(({ roleId, filter }) => [roleId, filter]),
                ),
              }
            : {}),
        },
      ]),
  );
}

export function buildActionPermissions(
  environmentPermissions: EnvironmentPermissionsV4,
): ActionPermissions {
  if (environmentPermissions === true) {
    return {
      isDevelopment: true,
      actionsGloballyAllowed: new Set(),
      actionsByRole: new Map(),
    };
  }

  const rights = {
    ...buildCollectionRights(environmentPermissions.collections),
    ...buildActionRights(environmentPermissions.collections),
  };

  return {
    isDevelopment: false,
    actionsGloballyAllowed: collectGloballyAllowed(rights),
    actionsByRole: collectByRole(rights),
  };
}

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
