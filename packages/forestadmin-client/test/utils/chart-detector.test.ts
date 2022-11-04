import {
  ApiRouteChart,
  ChartType,
  LeaderboardChart,
  LineChart,
  ObjectiveChart,
  PieChart,
  ValueChart,
} from '../../src/charts/types';
import ChartDetector from '../../src/utils/chart-detector';

describe('ChartDetector', () => {
  const apiChart: ApiRouteChart = {
    type: ChartType.Value,
    apiRoute: '/test/me',
  };
  const valueChart: ValueChart = {
    type: ChartType.Value,
    aggregateFieldName: 'length',
    aggregator: 'Sum',
    sourceCollectionName: 'siths',
    filter: {
      aggregator: 'or',
      conditions: [
        {
          field: 'name',
          operator: 'equal',
          value: 'Vador',
        },
      ],
    },
  };
  const pieChart: PieChart = {
    type: ChartType.Pie,
    groupByFieldName: 'Master',
    aggregateFieldName: 'length',
    aggregator: 'Sum',
    sourceCollectionName: 'siths',
    filter: {
      aggregator: 'or',
      conditions: [
        {
          field: 'name',
          operator: 'equal',
          value: 'Vador',
        },
      ],
    },
  };
  const lineChart: LineChart = {
    type: ChartType.Line,
    groupByFieldName: 'birthDate',
    timeRange: 'Year',
    aggregateFieldName: 'length',
    aggregator: 'Sum',
    sourceCollectionName: 'siths',
    filter: {
      aggregator: 'or',
      conditions: [
        {
          field: 'name',
          operator: 'equal',
          value: 'Vador',
        },
      ],
    },
  };
  const objectiveChart: ObjectiveChart = {
    type: ChartType.Objective,
    objective: 1000,
    aggregateFieldName: 'length',
    aggregator: 'Sum',
    sourceCollectionName: 'siths',
    filter: {
      aggregator: 'or',
      conditions: [
        {
          field: 'name',
          operator: 'equal',
          value: 'Vador',
        },
      ],
    },
  };
  const leaderboardChart: LeaderboardChart = {
    type: ChartType.Leaderboard,
    labelFieldName: 'Master',
    relationshipFieldName: 'lightSaber',
    aggregateFieldName: 'length',
    aggregator: 'Sum',
    sourceCollectionName: 'siths',
    limit: 10,
  };

  describe('isAPIRouteChart', () => {
    test("it should return true if it's an api chart", () => {
      expect(ChartDetector.isAPIRouteChart(apiChart)).toBe(true);
      expect(ChartDetector.isAPIRouteChart(valueChart)).toBe(false);
      expect(ChartDetector.isAPIRouteChart(pieChart)).toBe(false);
      expect(ChartDetector.isAPIRouteChart(lineChart)).toBe(false);
      expect(ChartDetector.isAPIRouteChart(objectiveChart)).toBe(false);
      expect(ChartDetector.isAPIRouteChart(leaderboardChart)).toBe(false);
    });
  });

  describe('isLineChart', () => {
    test("it should return true if it's a line chart", () => {
      expect(ChartDetector.isLineChart(apiChart)).toBe(false);
      expect(ChartDetector.isLineChart(valueChart)).toBe(false);
      expect(ChartDetector.isLineChart(pieChart)).toBe(false);
      expect(ChartDetector.isLineChart(lineChart)).toBe(true);
      expect(ChartDetector.isLineChart(objectiveChart)).toBe(false);
      expect(ChartDetector.isLineChart(leaderboardChart)).toBe(false);
    });
  });

  describe('isObjectiveChart', () => {
    test("it should return true if it's a line chart", () => {
      expect(ChartDetector.isObjectiveChart(apiChart)).toBe(false);
      expect(ChartDetector.isObjectiveChart(valueChart)).toBe(false);
      expect(ChartDetector.isObjectiveChart(pieChart)).toBe(false);
      expect(ChartDetector.isObjectiveChart(lineChart)).toBe(false);
      expect(ChartDetector.isObjectiveChart(objectiveChart)).toBe(true);
      expect(ChartDetector.isObjectiveChart(leaderboardChart)).toBe(false);
    });
  });

  describe('isLeaderboardChart', () => {
    test("it should return true if it's a line chart", () => {
      expect(ChartDetector.isLeaderboardChart(apiChart)).toBe(false);
      expect(ChartDetector.isLeaderboardChart(valueChart)).toBe(false);
      expect(ChartDetector.isLeaderboardChart(pieChart)).toBe(false);
      expect(ChartDetector.isLeaderboardChart(lineChart)).toBe(false);
      expect(ChartDetector.isLeaderboardChart(objectiveChart)).toBe(false);
      expect(ChartDetector.isLeaderboardChart(leaderboardChart)).toBe(true);
    });
  });

  describe('isFilterableChart', () => {
    test("it should return true if it's a line chart", () => {
      expect(ChartDetector.isFilterableChart(apiChart)).toBe(false);
      expect(ChartDetector.isFilterableChart(valueChart)).toBe(true);
      expect(ChartDetector.isFilterableChart(pieChart)).toBe(true);
      expect(ChartDetector.isFilterableChart(lineChart)).toBe(true);
      expect(ChartDetector.isFilterableChart(objectiveChart)).toBe(true);
      expect(ChartDetector.isFilterableChart(leaderboardChart)).toBe(false);
    });
  });

  describe('isAggregatedChart', () => {
    test("it should return true if it's a line chart", () => {
      expect(ChartDetector.isAggregatedChart(apiChart)).toBe(false);
      expect(ChartDetector.isAggregatedChart(valueChart)).toBe(true);
      expect(ChartDetector.isAggregatedChart(pieChart)).toBe(true);
      expect(ChartDetector.isAggregatedChart(lineChart)).toBe(true);
      expect(ChartDetector.isAggregatedChart(objectiveChart)).toBe(true);
      expect(ChartDetector.isAggregatedChart(leaderboardChart)).toBe(true);
    });
  });
});
