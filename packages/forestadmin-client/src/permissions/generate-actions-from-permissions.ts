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
  UserPermissionV4,
} from './types';

export type ActionPermissions = {
  everythingAllowed: boolean;
  actionsGloballyAllowed: Set<string>;
  actionsAllowedByUser: Map<string, Set<string>>;
  actionsConditionByRoleId: Map<string, Map<number, RawTreeWithSources>>;
  users: UserPermissionV4[];
};

type IntermediateRightsList = {
  [key: string]: {
    rightDescription: RightDescriptionV4;
    rightConditions?: RightConditionByRolesV4[];
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
        rightDescription: collection.browseEnabled,
      },
      [generateCollectionActionIdentifier(CollectionActionEvent.Read, collectionId)]: {
        rightDescription: collection.readEnabled,
      },
      [generateCollectionActionIdentifier(CollectionActionEvent.Edit, collectionId)]: {
        rightDescription: collection.editEnabled,
      },
      [generateCollectionActionIdentifier(CollectionActionEvent.Add, collectionId)]: {
        rightDescription: collection.addEnabled,
      },
      [generateCollectionActionIdentifier(CollectionActionEvent.Delete, collectionId)]: {
        rightDescription: collection.deleteEnabled,
      },
      [generateCollectionActionIdentifier(CollectionActionEvent.Export, collectionId)]: {
        rightDescription: collection.exportEnabled,
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
          rightDescription: actionPermissions.userApprovalEnabled,
          rightConditions: actionPermissions.userApprovalConditions,
        },
        [generateCustomActionIdentifier(CustomActionEvent.SelfApprove, actionName, collectionId)]: {
          rightDescription: actionPermissions.selfApprovalEnabled,
        },

        [generateCustomActionIdentifier(CustomActionEvent.Trigger, actionName, collectionId)]: {
          rightDescription: actionPermissions.triggerEnabled,
          rightConditions: actionPermissions.triggerConditions,
        },

        [generateCustomActionIdentifier(
          CustomActionEvent.RequireApproval,
          actionName,
          collectionId,
        )]: {
          rightDescription: actionPermissions.approvalRequired,
          rightConditions: actionPermissions.approvalRequiredConditions,
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
      .filter(([, permission]) => permission.rightDescription === true)
      .map(([action]) => action),
  );
}

function getUsersForRoles(roles: number[], userIdsByRole: Map<number, number[]>): Set<string> {
  return new Set(
    roles.reduce((acc, roleId) => {
      const userIds = (userIdsByRole.get(roleId) || []).map(userId => `${userId}`);

      return [...acc, ...userIds];
    }, []),
  );
}

function generateActionsAllowedByUser(
  permissions: IntermediateRightsList,
  users: UserPermissionV4[],
): Map<string, Set<string>> {
  const userIdsByRole = users.reduce((acc, { id, roleId }) => {
    acc.set(roleId, [...(acc.get(roleId) || []), id]);

    return acc;
  }, new Map<number, number[]>());

  return new Map(
    Object.entries(permissions)
      .filter(([, permission]) => typeof permission.rightDescription !== 'boolean')
      .map(([name, permission]) => [
        name,
        getUsersForRoles(
          (permission.rightDescription as RightDescriptionWithRolesV4).roles,
          userIdsByRole,
        ),
      ]),
  );
}

function generateActionsConditionByRoleId(
  permissions: IntermediateRightsList,
): Map<string, Map<number, RawTreeWithSources>> {
  return new Map(
    Object.entries(permissions)
      .filter(([, permission]) => permission.rightConditions)
      .map(([name, permission]) => [
        name,
        new Map(permission.rightConditions?.map(({ roleId, filter }) => [roleId, filter])),
      ]),
  );
}

export default function generateActionsFromPermissions(
  environmentPermissions: EnvironmentPermissionsV4,
  users: UserPermissionV4[],
): ActionPermissions {
  if (environmentPermissions === true) {
    return {
      everythingAllowed: true,
      actionsGloballyAllowed: new Set(),
      actionsAllowedByUser: new Map(),
      actionsConditionByRoleId: new Map(),
      users: [],
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
    actionsAllowedByUser: generateActionsAllowedByUser(allPermissions, users),
    actionsConditionByRoleId: generateActionsConditionByRoleId(allPermissions),
    users,
  };
}
