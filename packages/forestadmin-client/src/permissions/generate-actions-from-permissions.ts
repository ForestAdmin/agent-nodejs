import type {
  EnvironmentCollectionActionPermissionsV4,
  EnvironmentCollectionsPermissionsV4,
  EnvironmentPermissionsV4,
  EnvironmentPermissionsV4Remote,
  RawTreeWithSources,
  RightConditionByRolesV4,
  RightDescriptionV4,
  RightDescriptionWithRolesV4,
} from './types';

import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './generate-action-identifier';
import { CollectionActionEvent, CustomActionEvent } from './types';

export type ActionPermissions = {
  isDevelopment: boolean;
  actionsGloballyAllowed: Set<string>;
  actionsByRole: Map<string, ActionPermission>;
};

export type ActionPermission = {
  allowedRoles: Set<number>;
  conditionsByRole?: Map<number, RawTreeWithSources>;
};

type IntermediateRightsList = Map<
  string,
  {
    description: RightDescriptionV4;
    conditions?: RightConditionByRolesV4[];
  }
>;

function addCollectionPermissions(
  rights: IntermediateRightsList,
  permissions: EnvironmentCollectionsPermissionsV4,
): void {
  for (const [collectionId, { collection }] of Object.entries(permissions)) {
    rights.set(generateCollectionActionIdentifier(CollectionActionEvent.Browse, collectionId), {
      description: collection.browseEnabled,
    });
    rights.set(generateCollectionActionIdentifier(CollectionActionEvent.Read, collectionId), {
      description: collection.readEnabled,
    });
    rights.set(generateCollectionActionIdentifier(CollectionActionEvent.Edit, collectionId), {
      description: collection.editEnabled,
    });
    rights.set(generateCollectionActionIdentifier(CollectionActionEvent.Add, collectionId), {
      description: collection.addEnabled,
    });
    rights.set(generateCollectionActionIdentifier(CollectionActionEvent.Delete, collectionId), {
      description: collection.deleteEnabled,
    });
    rights.set(generateCollectionActionIdentifier(CollectionActionEvent.Export, collectionId), {
      description: collection.exportEnabled,
    });
  }
}

function addCustomActionPermissions(
  rights: IntermediateRightsList,
  collectionId: string,
  actions: EnvironmentCollectionActionPermissionsV4,
): void {
  for (const [actionName, actionPermissions] of Object.entries(actions)) {
    rights.set(
      generateCustomActionIdentifier(CustomActionEvent.Approve, actionName, collectionId),
      {
        description: actionPermissions.userApprovalEnabled,
        conditions: actionPermissions.userApprovalConditions,
      },
    );
    rights.set(
      generateCustomActionIdentifier(CustomActionEvent.SelfApprove, actionName, collectionId),
      {
        description: actionPermissions.selfApprovalEnabled,
      },
    );
    rights.set(
      generateCustomActionIdentifier(CustomActionEvent.Trigger, actionName, collectionId),
      {
        description: actionPermissions.triggerEnabled,
        conditions: actionPermissions.triggerConditions,
      },
    );
    rights.set(
      generateCustomActionIdentifier(CustomActionEvent.RequireApproval, actionName, collectionId),
      {
        description: actionPermissions.approvalRequired,
        conditions: actionPermissions.approvalRequiredConditions,
      },
    );
  }
}

function splitActionPermissions(
  permissions: IntermediateRightsList,
): Pick<ActionPermissions, 'actionsGloballyAllowed' | 'actionsByRole'> {
  const actionsGloballyAllowed = new Set<string>();
  const actionsByRole = new Map<string, ActionPermission>();

  for (const [name, { description, conditions }] of permissions) {
    if (description === true) {
      actionsGloballyAllowed.add(name);
    } else if (description !== false) {
      const permission: ActionPermission = {
        allowedRoles: new Set((description as RightDescriptionWithRolesV4).roles),
      };

      if (conditions) {
        permission.conditionsByRole = new Map(
          conditions.map(({ roleId, filter }) => [roleId, filter]),
        );
      }

      actionsByRole.set(name, permission);
    }
  }

  return { actionsGloballyAllowed, actionsByRole };
}

export default function generateActionsFromPermissions(
  environmentPermissions: EnvironmentPermissionsV4,
): ActionPermissions {
  if (environmentPermissions === true) {
    return {
      isDevelopment: true,
      actionsGloballyAllowed: new Set(),
      actionsByRole: new Map(),
    };
  }

  const remotePermissions: EnvironmentPermissionsV4Remote = environmentPermissions;

  const allPermissions: IntermediateRightsList = new Map();
  addCollectionPermissions(allPermissions, remotePermissions.collections);

  for (const [collectionId, { actions }] of Object.entries(remotePermissions.collections)) {
    addCustomActionPermissions(allPermissions, collectionId, actions);
  }

  return { isDevelopment: false, ...splitActionPermissions(allPermissions) };
}
