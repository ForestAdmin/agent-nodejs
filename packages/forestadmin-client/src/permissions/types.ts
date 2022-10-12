import type { GenericTree } from '@forestadmin/datasource-toolkit';

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
}

export interface FilterableChart extends BaseChart {
  filter?: string;
}

export interface AggregatedChart extends BaseChart {
  aggregator: 'Sum' | 'Count';
  aggregateFieldName: string | null;
}

export interface CollectionChart extends BaseChart {
  sourceCollectionId: string | number;
}

export interface GroupedByChart extends BaseChart {
  groupByFieldName: string | null;
}

export interface LeaderboardChart extends BaseChart, AggregatedChart, CollectionChart {
  type: ChartType.Leaderboard;
  labelFieldName: string;
  relationshipFieldName: string;
  limit: number;
}

export interface LineChart
  extends BaseChart,
    FilterableChart,
    AggregatedChart,
    CollectionChart,
    GroupedByChart {
  type: ChartType.Line;
  timeRange: 'Day' | 'Week' | 'Month' | 'Year';
}

export interface ObjectiveChart
  extends BaseChart,
    FilterableChart,
    AggregatedChart,
    CollectionChart {
  type: ChartType.Objective;
  objective: number;
}

export interface PercentageChart extends BaseChart {
  type: ChartType.Percentage;
  numeratorChartId: string;
  denominatorChartId: string;
}

export interface PieChart
  extends BaseChart,
    FilterableChart,
    AggregatedChart,
    CollectionChart,
    GroupedByChart {
  type: ChartType.Pie;
}

export interface ValueChart extends BaseChart, FilterableChart, AggregatedChart, CollectionChart {
  type: ChartType.Value;
}

export type Chart =
  | ApiRouteChart
  | QueryChart
  | SmartRouteChart
  | LeaderboardChart
  | LineChart
  | ObjectiveChart
  | PercentageChart
  | PieChart
  | ValueChart;

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
  stats: Chart[];
};
