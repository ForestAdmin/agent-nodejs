import {
  CollectionActionEvent,
  CustomActionEvent,
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './action-identifiers';

export type RightDescriptionWithRolesV4 = { roles: number[] };
export type RightDescriptionV4 = boolean | RightDescriptionWithRolesV4;

export type RightConditionByRolesV4 = {
  roleId: number;
  filter: unknown;
};

export interface EnvironmentCollectionAccessPermissionsV4 {
  browseEnabled: RightDescriptionV4;
  readEnabled: RightDescriptionV4;
  editEnabled: RightDescriptionV4;
  addEnabled: RightDescriptionV4;
  deleteEnabled: RightDescriptionV4;
  exportEnabled: RightDescriptionV4;
}

export interface EnvironmentSmartActionPermissionsV4 {
  triggerEnabled: RightDescriptionV4;
  triggerConditions: RightConditionByRolesV4[];
  approvalRequired: RightDescriptionV4;
  approvalRequiredConditions: RightConditionByRolesV4[];
  userApprovalEnabled: RightDescriptionV4;
  userApprovalConditions: RightConditionByRolesV4[];
  selfApprovalEnabled: RightDescriptionV4;
}

export interface EnvironmentCollectionActionPermissionsV4 {
  [actionName: string]: EnvironmentSmartActionPermissionsV4;
}

export interface EnvironmentCollectionPermissionsV4 {
  collection: EnvironmentCollectionAccessPermissionsV4;
  actions: EnvironmentCollectionActionPermissionsV4;
}

export interface EnvironmentCollectionsPermissionsV4 {
  [collectionName: string]: EnvironmentCollectionPermissionsV4;
}

export type EnvironmentPermissionsV4Remote = {
  collections: EnvironmentCollectionsPermissionsV4;
};

export type EnvironmentPermissionsV4 = EnvironmentPermissionsV4Remote | true;

export type ActionPermission = {
  allowedRoles: Set<number>;
  conditionsByRole?: Map<number, unknown>;
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

export function canRoleTriggerAction(
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
  return canRoleTriggerAction(
    permissions,
    roleId,
    generateCollectionActionIdentifier(action, collectionName),
  );
}

export function canRolePerformCustomAction(
  permissions: ActionPermissions,
  roleId: number,
  event: CustomActionEvent,
  actionName: string,
  collectionName: string,
): boolean {
  return canRoleTriggerAction(
    permissions,
    roleId,
    generateCustomActionIdentifier(event, actionName, collectionName),
  );
}
