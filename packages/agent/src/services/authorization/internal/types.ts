import { GenericTree } from '@forestadmin/datasource-toolkit';

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
  User = 'user',
}

export type UserPermissionV4 = {
  id: number;
  firstName: string;
  lastName: string;
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

export enum ChartType {
  Pie = 'Pie',
  Value = 'Value',
  Leaderboard = 'Leaderboard',
  Line = 'Line',
  Objective = 'Objective',
  Percentage = 'Percentage',
  Smart = 'Smart',
}

export interface DisplaySettings {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BaseChart {
  type: ChartType;
}

export interface SmartRouteChart extends BaseChart {
  type: Exclude<ChartType, ChartType.Smart>;
  smartRoute: string;
}

export interface ApiRouteChart extends BaseChart {
  type: Exclude<ChartType, ChartType.Smart>;
  apiRoute: string;
}

export interface QueryChart extends BaseChart {
  type: Exclude<ChartType, ChartType.Smart>;
  query: string;
  filter?: Record<string, any>; // To be completed
}
export interface S3Versions {
  'component.js': string;
  'template.hbs': string;
}

export interface SmartChart extends BaseChart {
  type: ChartType.Smart;
  s3Versions: S3Versions & { 'style.css': string };
  id: string;
}

export interface LeaderboardChart extends BaseChart {
  type: ChartType.Leaderboard;
  sourceCollectionId: string | number;
  labelFieldName: string;
  relationshipFieldName: string;
  aggregateFieldName: string | null;
  aggregator: 'Sum' | 'Count';
  limit;
}

export interface LineChart extends BaseChart {
  type: ChartType.Line;
  sourceCollectionId: string | number;
  groupByFieldName: string;
  aggregateFieldName: string | null;
  aggregator: 'Sum' | 'Count';
  timeRange: 'Day' | 'Week' | 'Month' | 'Year';
  filter: Filter | null;
}

export interface ObjectiveChart extends BaseChart {
  type: ChartType.Objective;
  sourceCollectionId: string | number;
  aggregateFieldName: string;
  aggregator: 'Sum' | 'Count';
  objective: number;
  filter: Filter | null;
}

export interface PercentageChart extends BaseChart {
  type: ChartType.Percentage;
  numeratorChartId: string;
  denominatorChartId: string;
}

export interface PieChart extends BaseChart {
  type: ChartType.Pie;
  sourceCollectionId: string | number;
  aggregateFieldName: string;
  groupByFieldName: string;
  aggregator: 'Sum' | 'Count';
  filter: Filter | null;
}

export interface ValueChart extends BaseChart {
  type: ChartType.Value;
  sourceCollectionId: string | number;
  aggregateFieldName: string;
  aggregator: 'Sum' | 'Count';
  filter: Filter | null;
}

export type Chart =
  | SmartChart
  | ApiRouteChart
  | QueryChart
  | SmartRouteChart
  | LeaderboardChart
  | LineChart
  | ObjectiveChart
  | PercentageChart
  | PieChart
  | ValueChart;

export interface RenderingChartDefinitions {
  queries: string[];
  leaderboards: LeaderboardChart[];
  lines: LineChart[];
  objectives: ObjectiveChart[];
  percentages: PercentageChart[];
  pies: PieChart[];
  values: ValueChart[];
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

export interface ManualCollectionSegment extends BaseCollectionSegment {
  type: 'manual';
  filter: Filter | null;
  query: string | null;
}
export interface SmartCollectionSegment extends BaseCollectionSegment {
  type: 'smart';
}

export type CollectionSegment = ManualCollectionSegment | SmartCollectionSegment;

export type DynamicScopesValues = {
  users: Record<string, Record<string, string | number>>;
};

export type CollectionRenderingPermissionV4 = {
  scope: GenericTree | null;
  segments: CollectionSegment[];
};

export type Team = { id: number; name: string };

export type RenderingPermissionV4 = {
  team: Team;
  collections: Record<string, CollectionRenderingPermissionV4>;
  stats: RenderingChartDefinitions;
};

export type User = Record<string, any> & {
  id: number;
  tags: Record<string, string>;
};

export interface ActionApprovalAttributes {
  requester_id: number;
  ids: Array<string>;
  collection_name: string;
  smart_action_id: string;
  values: any | null;
  parent_collection_name: string | null;
  parent_collection_id: string | null;
  parent_association_name: string | null;
  all_records: boolean;
  all_records_subset_query: null;
}

export type ActionApprovalJWT = {
  data: {
    id: string | number;
    type: string;
    attributes: ActionApprovalAttributes;
  };
};
