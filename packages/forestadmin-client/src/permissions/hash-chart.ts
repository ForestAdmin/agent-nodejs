import hashObject from 'object-hash';

import { Chart, ChartKeys } from '../charts/types';

function hashChart(chart: Chart): string {
  const knownChartKeys: ChartKeys[] = [
    'type',
    'apiRoute',
    'smartRoute',
    'query',
    'labelFieldName',
    'filter',
    'sourceCollectionName',
    'aggregator',
    'aggregateFieldName',
    'groupByFieldName',
    'relationshipFieldName',
    'limit',
    'timeRange',
    'objective',
    'numeratorChartId',
    'denominatorChartId',
  ];

  const hash = hashObject(chart, {
    respectType: false,
    excludeKeys: key =>
      chart[key] === null || chart[key] === undefined || !knownChartKeys.includes(key as ChartKeys),
  });

  return hash;
}

export function hashServerCharts(charts: Chart[]): Set<string> {
  const hashes = charts.map(hashChart);

  return new Set(hashes);
}

export function isGroupedByChart(chart: Chart): chart is Chart & { groupByFieldName?: string } {
  return 'groupByFieldName' in chart;
}

export function hashChartRequest(chart: Chart): string {
  return hashChart(chart);
}
