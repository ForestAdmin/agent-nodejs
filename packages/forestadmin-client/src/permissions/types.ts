import type { Chart } from '../charts/types';

type GenericRawTree<RawLeaf, RawBranch> = RawBranch | RawLeaf;

export type RawTreeBranch = {
  aggregator: string;
  conditions: Array<RawTreeBranch | RawTreeLeaf>;
};

export type RawTreeLeaf = { field: string; operator: string; value?: unknown };

export type RawTree = GenericRawTree<RawTreeLeaf, RawTreeBranch>;

export type CustomActionRawTreeLeafSource = 'data' | 'input';
export type RawTreeLeafWithSources = RawTreeLeaf & { source: CustomActionRawTreeLeafSource };
export type RawTreeBranchWithSources = {
  aggregator: RawTreeBranch['aggregator'];
  conditions: Array<RawTreeBranchWithSources | RawTreeLeafWithSources>;
};

export type RawTreeWithSources = GenericRawTree<RawTreeLeafWithSources, RawTreeBranchWithSources>;

export type EnvironmentPermissionsV4 = EnvironmentPermissionsV4Remote | true;

export type RightDescriptionWithRolesV4 = { roles: number[] };
export type RightDescriptionV4 = boolean | RightDescriptionWithRolesV4;

export type RightConditionByRolesV4 = {
  roleId: number;
  filter: RawTreeWithSources;
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
  [id: string]: EnvironmentCollectionPermissionsV4;
}

export interface EnvironmentPermissionsV4Remote {
  collections: EnvironmentCollectionsPermissionsV4;
}

export enum PermissionLevel {
  Admin = 'admin',
  Developer = 'developer',
  Editor = 'editor',
  User = 'user',
}

export type UserPermissionV4 = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  permissionLevel: PermissionLevel;
  tags: Record<string, string>;
  roleId: number;
};

export enum CollectionActionEvent {
  Browse = 'browse',
  Export = 'export',
  Read = 'read',
  Edit = 'edit',
  Delete = 'delete',
  Add = 'add',
}

export enum CustomActionEvent {
  Trigger = 'trigger',
  Approve = 'approve',
  SelfApprove = 'self-approve',
  RequireApproval = 'require-approval',
}

export interface DisplaySettings {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollectionColumn {
  id: string | number;
  fieldName: string;
  position: number | null;
  isVisible: boolean;
}

export interface BaseCollectionSegment {
  id: string | number;
  type: 'manual' | 'smart';
  name: string;
  position: number;
  defaultSortingFieldName: string | null;
  defaultSortingFieldOrder: 'ascending' | 'descending' | null;
  isVisible: boolean;
  hasColumnsConfiguration: boolean;
  columns: CollectionColumn[];
}

export interface FilterCondition {
  id: string;
  value: boolean | number | string | string[];
  fieldName: string | null;
  subFieldName: string | null;
  embeddedFieldName?: string | null;
  operator: string;
  embeddedField?: {
    id?: number;
    type: string;
    field: string;
    enums?: Array<string | number | Record<string, string>>;
  } | null;
}

export interface Filter {
  id?: string;
  type: 'and' | 'or';
  conditions: FilterCondition[] | null;
}

export type DynamicScopesValues = {
  users: Record<string, Record<string, string | number>>;
};

export type CollectionRenderingPermissionV4 = {
  scope: RawTree | null;
  segments: string[];
};

export type Team = { id: number; name: string };

export type RenderingPermissionV4 = {
  team: Team;
  collections: Record<string, CollectionRenderingPermissionV4>;
  stats: Chart[];
};
