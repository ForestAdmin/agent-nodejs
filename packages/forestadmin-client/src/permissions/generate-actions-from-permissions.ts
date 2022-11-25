import {
  generateCollectionActionIdentifier,
  generateCustomActionIdentifier,
} from './generate-action-identifier';
import {
  CollectionActionEvent,
  CustomActionEvent,
  EnvironmentCollectionActionPermissionsV4,
  EnvironmentCollectionsPermissionsV4,
  EnvironmentPermissionsV4,
  EnvironmentPermissionsV4Remote,
  RawTreeWithSources,
  RightConditionByRolesV4,
  RightDescriptionV4,
  RightDescriptionWithRolesV4,
} from './types';

export type ActionPermissions = {
  everythingAllowed: boolean;
  actionsGloballyAllowed: Set<string>;
  actionsByRole: Map<string, ActionPermission>;
};

export type ActionPermission = {
  allowedRoles: Set<number>;
  conditionsByRole?: Map<number, RawTreeWithSources>;
};

type IntermediateRightsList = {
  [key: string]: {
    description: RightDescriptionV4;
    conditions?: RightConditionByRolesV4[];
  };
};

function generateCollectionPermissions(
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

function generateCustomActionPermission(
  collectionId: string,
  actions: EnvironmentCollectionActionPermissionsV4,
): IntermediateRightsList {
  return Object.entries(actions).reduce((acc, [actionName, actionPermissions]) => {
    return {
      ...acc,
      ...{
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

        [generateCustomActionIdentifier(
          CustomActionEvent.RequireApproval,
          actionName,
          collectionId,
        )]: {
          description: actionPermissions.approvalRequired,
          conditions: actionPermissions.approvalRequiredConditions,
        },
      },
    };
  }, {});
}

function generateActionPermissions(
  permissions: EnvironmentCollectionsPermissionsV4,
): IntermediateRightsList {
  return Object.entries(permissions).reduce((acc, [collectionId, collectionPermissions]) => {
    const { actions } = collectionPermissions;

    return {
      ...acc,
      ...generateCustomActionPermission(collectionId, actions),
    };
  }, {});
}

function generateActionsGloballyAllowed(permissions: IntermediateRightsList): Set<string> {
  return new Set(
    Object.entries(permissions)
      .filter(([, permission]) => permission.description === true)
      .map(([action]) => action),
  );
}

function generateActionsByRole(permissions: IntermediateRightsList): Map<string, ActionPermission> {
  return new Map(
    Object.entries(permissions)
      .filter(([, permission]) => typeof permission.description !== 'boolean')
      .map(([name, permission]) => [
        name,
        {
          allowedRoles: new Set((permission.description as RightDescriptionWithRolesV4).roles),
          ...(permission.conditions
            ? {
                conditionsByRole: new Map(
                  permission.conditions?.map(({ roleId, filter }) => [roleId, filter]),
                ),
              }
            : {}),
        },
      ]),
  );
}

export default function generateActionsFromPermissions(
  environmentPermissions: EnvironmentPermissionsV4,
): ActionPermissions {
  if (environmentPermissions === true) {
    return {
      everythingAllowed: true,
      actionsGloballyAllowed: new Set(),
      actionsByRole: new Map(),
    };
  }

  const remotePermissions: EnvironmentPermissionsV4Remote = environmentPermissions;

  const allPermissions = {
    ...generateCollectionPermissions(remotePermissions.collections),
    ...generateActionPermissions(remotePermissions.collections),
  };

  return {
    everythingAllowed: false,
    actionsGloballyAllowed: generateActionsGloballyAllowed(allPermissions),
    actionsByRole: generateActionsByRole(allPermissions),
  };
}
