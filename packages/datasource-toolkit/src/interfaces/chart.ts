export type ValueChart = { countCurrent: number; countPrevious: number };
export type DistributionChart = Array<{ key: string; value: number }>;
export type TimeBasedChart = Array<{ label: string; values: Record<string, number> }>;
export type MultipleTimeBasedChart = {
  labels: string[];
  values: Array<{ key: string; values: number[] }>;
};
export type PercentageChart = number;
export type ObjectiveChart = { value: number; objective: number };
export type LeaderboardChart = Array<{ key: string; value: number }>;
export type SmartChart = unknown;

export type Chart =
  | ValueChart
  | DistributionChart
  | TimeBasedChart
  | PercentageChart
  | ObjectiveChart
  | LeaderboardChart
  | SmartChart;
