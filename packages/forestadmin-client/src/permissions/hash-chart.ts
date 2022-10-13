import hashObject from 'object-hash';

import { Chart, ChartType } from '../charts/types';

function hashChart(chart: Chart): string {
  const hash = hashObject(chart, {
    respectType: false,
    excludeKeys: key => chart[key] === null || chart[key] === undefined,
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
  // When the server sends the data of the allowed charts, the target column is not specified
  // for relations => allow them all.
  if (isGroupedByChart(chart)) {
    chart.groupByFieldName = chart?.groupByFieldName?.includes(':')
      ? chart.groupByFieldName.substring(0, chart.groupByFieldName.indexOf(':'))
      : chart.groupByFieldName;
  }

  return hashChart(chart);
}
