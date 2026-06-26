import type { RawTreeWithSources } from '@forestadmin/forestadmin-client';

export type SmartActionPermissionsOverride = Partial<{
  triggerEnabled: boolean;
  triggerConditions: RawTreeWithSources;
  approvalRequired: boolean;
  approvalRequiredConditions: RawTreeWithSources;
  userApprovalEnabled: boolean;
  userApprovalConditions: RawTreeWithSources;
  selfApprovalEnabled: boolean;
}>;

export type CollectionPermissionsOverride = Partial<{
  browseEnabled: boolean;
  deleteEnabled: boolean;
  editEnabled: boolean;
  exportEnabled: boolean;
  addEnabled: boolean;
  readEnabled: boolean;
}>;

export type PermissionsOverride = Record<
  string,
  {
    collection: CollectionPermissionsOverride;
    actions: Record<string, SmartActionPermissionsOverride>;
  }
>;
