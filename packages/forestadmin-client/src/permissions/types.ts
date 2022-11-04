import type { Chart } from '../charts/types';

const UNIQUE_OPERATORS = [
  // All types besides arrays
  'equal',
  'not_equal',
  'less_than',
  'greater_than',

  // Strings
  'not_contains',

  // Arrays
  'includes_all',
] as const;

const INTERVAL_OPERATORS = [
  // Dates
  'today',
  'yesterday',
  'previous_month',
  'previous_quarter',
  'previous_week',
  'previous_year',
  'previous_month_to_date',
  'previous_quarter_to_date',
  'previous_week_to_date',
  'previous_x_days_to_date',
  'previous_x_days',
  'previous_year_to_date',
] as const;

const OTHER_OPERATORS = [
  // All types
  'present',
  'blank',
  'missing',

  // All types besides arrays
  'in',
  'not_in',

  // Strings
  'starts_with',
  'ends_with',
  'contains',
  'i_starts_with',
  'i_ends_with',
  'i_contains',

  // Dates
  'before',
  'after',
  'after_x_hours_ago',
  'before_x_hours_ago',
  'future',
  'past',
] as const;

export const RAW_FILTER_OPERATORS = [
  ...UNIQUE_OPERATORS,
  ...INTERVAL_OPERATORS,
  ...OTHER_OPERATORS,
];

export type RawOperator = typeof RAW_FILTER_OPERATORS[number];

export const CUSTOM_ACTION_FILTER_LEAF_SOURCES = ['data', 'input'];

export type CustomActionFilterLeafSource = typeof CUSTOM_ACTION_FILTER_LEAF_SOURCES[number];

export const RAW_FILTER_TREE_AGGREGATORS = ['and', 'or'];

export type FilterTreeAggregator = typeof RAW_FILTER_TREE_AGGREGATORS[number];

export type GenericRawTreeBranch<T> = {
  aggregator: FilterTreeAggregator;
  conditions: Array<GenericRawTree<T>>;
};

type GenericRawTree<T> = GenericRawTreeBranch<T> | T;

export type RawTreeLeaf = {
  field: string;
  operator: RawOperator;
  value?: unknown;
};

export type RawTree = GenericRawTree<RawTreeLeaf>;

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
