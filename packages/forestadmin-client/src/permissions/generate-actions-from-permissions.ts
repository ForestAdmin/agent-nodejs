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
  // specificToRole: Map<number, {
  //   actionCondition: RawTreeWithSource
  // }>;
};

type IntermediateRightsList = {
  [key: string]: RightDescriptionV4;
};

function generateCollectionPermissions(
  permissions: EnvironmentCollectionsPermissionsV4,
): IntermediateRightsList {
  return Object.entries(permissions).reduce((acc, [collectionId, collectionPermissions]) => {
    const { collection } = collectionPermissions;

    return {
      ...acc,
      [generateCollectionActionIdentifier(CollectionActionEvent.Browse, collectionId)]:
        collection.browseEnabled,
      [generateCollectionActionIdentifier(CollectionActionEvent.Read, collectionId)]:
        collection.readEnabled,
      [generateCollectionActionIdentifier(CollectionActionEvent.Edit, collectionId)]:
        collection.editEnabled,
      [generateCollectionActionIdentifier(CollectionActionEvent.Add, collectionId)]:
        collection.addEnabled,
      [generateCollectionActionIdentifier(CollectionActionEvent.Delete, collectionId)]:
        collection.deleteEnabled,
      [generateCollectionActionIdentifier(CollectionActionEvent.Export, collectionId)]:
        collection.exportEnabled,
    };
  }, {});
}

function generateCollectionActionPermission(
  collectionId: string,
  actions: EnvironmentCollectionActionPermissionsV4,
): IntermediateRightsList {
  return Object.entries(actions).reduce((acc, [actionName, actionPermissions]) => {
    return {
      ...acc,
      ...{
        [generateCustomActionIdentifier(CustomActionEvent.Approve, actionName, collectionId)]:
          actionPermissions.userApprovalEnabled,
        [generateCustomActionIdentifier(CustomActionEvent.SelfApprove, actionName, collectionId)]:
          actionPermissions.selfApprovalEnabled,
        [generateCustomActionIdentifier(CustomActionEvent.Trigger, actionName, collectionId)]:
          actionPermissions.triggerEnabled,
        [generateCustomActionIdentifier(
          CustomActionEvent.RequireApproval,
          actionName,
          collectionId,
        )]: actionPermissions.approvalRequired,
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
      ...generateCollectionActionPermission(collectionId, actions),
    };
  }, {});
}

function generateActionsGloballyAllowed(permissions: IntermediateRightsList): Set<string> {
  return new Set(
    Object.entries(permissions)
      .filter(([, permission]) => permission === true)
      .map(([action]) => action),
  );
}

function generateActionsByRole(permissions: IntermediateRightsList): Map<string, ActionPermission> {
  return new Map(
    Object.entries(permissions)
      .filter(([, permission]) => typeof permission !== 'boolean')
      .map(([name, permission]) => [
        name,
        {
          allowedRoles: new Set((permission as RightDescriptionWithRolesV4).roles),
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
