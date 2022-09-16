export type EnvironmentPermissionsV4 = EnvironmentPermissionsV4Remote | true;

export type RightDescriptionWithRolesV4 = { roles: number[] };
export type RightDescriptionV4 = boolean | RightDescriptionWithRolesV4;

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
  approvalRequired: RightDescriptionV4;
  userApprovalEnabled: RightDescriptionV4;
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
  User = 'user',
  Developer = 'developer',
}

export type UserPermissionV4 = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
  permissionLevel: PermissionLevel;
  tags: Record<string, string>;
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
