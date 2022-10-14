import hashObject from 'object-hash';

import { Chart, ChartType } from '../charts/types';

function hashChart(chart: Chart): string {
  const knownChartKeys = [
    'type',
    'filter',
    'sourceCollectionName',
    'aggregator',
    'aggregateFieldName',
    'groupByFieldName',
    'labelFieldName',
    'relationshipFieldName',
    'limit',
    'timeRange',
    'objective',
    'numeratorChartId',
    'denominatorChartId',
    'apiRoute',
    'query',
  ];
  const hash = hashObject(chart, {
    respectType: false,
    excludeKeys: key =>
      chart[key] === null || chart[key] === undefined || !knownChartKeys.includes(key),
  });

  return hash;
}

export function hashServerCharts(charts: Chart[]): Set<string> {
  const hashes = charts.map(hashChart);

  return new Set(hashes);
}

export function isGroupedByChart(chart: Chart): chart is Chart & { groupByFieldName?: string } {
  return [
    ChartType.Leaderboard,
    ChartType.Line,
    ChartType.Objective,
    ChartType.Pie,
    ChartType.Value,
  ].includes(chart.type);
}

export function hashChartRequest(chart: Chart): string {
  return hashChart(chart);
}
