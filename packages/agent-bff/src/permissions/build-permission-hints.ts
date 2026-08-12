import type ReadModel from '../read-model/read-model';
import type { ActionPermissions } from '@forestadmin/forestadmin-client';

import { CollectionActionEvent, CustomActionEvent } from '@forestadmin/forestadmin-client';

import { canRolePerformCollectionAction, canRolePerformCustomAction } from './can-role-perform';

export const DISPLAY_HINT_FINALITY = 'display_hint';

export interface CrudHints {
  browse: boolean;
  read: boolean;
  edit: boolean;
  add: boolean;
  delete: boolean;
  export: boolean;
}

export interface ActionHints {
  collection: string;
  name: string;
  visible: boolean;
  requiresApprovalHint: boolean;
  canApproveHint: boolean;
  canSelfApproveHint: boolean;
  finality: typeof DISPLAY_HINT_FINALITY;
}

export interface VisibleActionRef {
  collection: string;
  name: string;
}

export interface CollectionHints {
  crud: CrudHints;
  actions: Record<string, ActionHints>;
}

export interface PermissionHints {
  collections: Record<string, CollectionHints>;
  visibleActions: VisibleActionRef[];
}

export interface BuildPermissionHintsParams {
  actionPermissions: ActionPermissions;
  roleId: number;
  readModel: ReadModel;
  collections: string[];
}

function buildCrudHints(
  permissions: ActionPermissions,
  roleId: number,
  collection: string,
): CrudHints {
  const can = (action: CollectionActionEvent) =>
    canRolePerformCollectionAction(permissions, roleId, action, collection);

  return {
    browse: can(CollectionActionEvent.Browse),
    read: can(CollectionActionEvent.Read),
    edit: can(CollectionActionEvent.Edit),
    add: can(CollectionActionEvent.Add),
    delete: can(CollectionActionEvent.Delete),
    export: can(CollectionActionEvent.Export),
  };
}

function visibleWithoutApprovalHints(collection: string, name: string): ActionHints {
  return {
    collection,
    name,
    visible: true,
    requiresApprovalHint: false,
    canApproveHint: false,
    canSelfApproveHint: false,
    finality: DISPLAY_HINT_FINALITY,
  };
}

function normalModeAction(
  permissions: ActionPermissions,
  roleId: number,
  collection: string,
  name: string,
): ActionHints {
  const can = (event: CustomActionEvent) =>
    canRolePerformCustomAction({
      permissions,
      roleId,
      event,
      actionName: name,
      collectionName: collection,
    });

  return {
    collection,
    name,
    visible: can(CustomActionEvent.Trigger),
    requiresApprovalHint: can(CustomActionEvent.RequireApproval),
    canApproveHint: can(CustomActionEvent.Approve),
    canSelfApproveHint: can(CustomActionEvent.SelfApprove),
    finality: DISPLAY_HINT_FINALITY,
  };
}

function buildCollectionHints(
  params: BuildPermissionHintsParams & { permissions: ActionPermissions },
  collection: string,
): CollectionHints {
  const { permissions, roleId, readModel } = params;
  const { isDevelopment } = permissions;
  const schemaExposedActionNames = Object.keys(readModel.getActionEndpoints()[collection] ?? {});

  const actions: Record<string, ActionHints> = Object.create(null);

  for (const name of schemaExposedActionNames) {
    actions[name] = isDevelopment
      ? visibleWithoutApprovalHints(collection, name)
      : normalModeAction(permissions, roleId, collection, name);
  }

  return { crud: buildCrudHints(permissions, roleId, collection), actions };
}

export default function buildPermissionHints(params: BuildPermissionHintsParams): PermissionHints {
  const permissions = params.actionPermissions;
  const collections: Record<string, CollectionHints> = Object.create(null);
  const visibleActions: VisibleActionRef[] = [];

  for (const collection of params.collections) {
    const hints = buildCollectionHints({ ...params, permissions }, collection);
    collections[collection] = hints;
    visibleActions.push(
      ...Object.values(hints.actions)
        .filter(action => action.visible)
        .map(({ name }) => ({ collection, name })),
    );
  }

  return { collections, visibleActions };
}
