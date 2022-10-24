import { PlainConditionTreeBranch } from '@forestadmin/datasource-toolkit';

export type KeysOfUnion<T> = T extends T ? keyof T : never;

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
  filter?: PlainConditionTreeBranch | null;
}

export interface AggregatedChart extends BaseChart {
  aggregate: 'Sum' | 'Count';
  aggregateFieldName: string | null;
}

export interface CollectionChart extends BaseChart {
  sourceCollectionName: string | number;
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

export enum ChartType {
  Pie = 'Pie',
  Value = 'Value',
  Leaderboard = 'Leaderboard',
  Line = 'Line',
  Objective = 'Objective',
  Percentage = 'Percentage',
  Smart = 'Smart',
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

export type ChartKeys = KeysOfUnion<Chart>;
