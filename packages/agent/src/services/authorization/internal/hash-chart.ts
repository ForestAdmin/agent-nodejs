import hashObject from 'object-hash';

import { RenderingChartDefinitions } from './types';

export function hashServerCharts(chartsByType: RenderingChartDefinitions): Set<string> {
  const serverCharts = Object.entries(chartsByType)
    .filter(([key]) => key !== 'queries')
    .map(([, value]) => value)
    .flat();

  const frontendCharts = serverCharts.map(chart => ({
    type: chart.type,
    filters: chart.filter,
    aggregate: chart.aggregator,
    aggregate_field: chart.aggregateFieldName,
    collection: chart.sourceCollectionId,
    time_range: chart.timeRange,
    group_by_date_field: (chart.type === 'Line' && chart.groupByFieldName) || null,
    group_by_field: (chart.type !== 'Line' && chart.groupByFieldName) || null,
    limit: chart.limit,
    label_field: chart.labelFieldName,
    relationship_field: chart.relationshipFieldName,
  }));

  const hashes = frontendCharts.map(chart =>
    hashObject(chart, {
      respectType: false,
      excludeKeys: key => chart[key] === null || chart[key] === undefined,
    }),
  );

  return new Set(hashes);
}

export function hashChartRequest(chart: any): string {
  const hashed = {
    ...chart,
    // When the server sends the data of the allowed charts, the target column is not specified
    // for relations => allow them all.
    ...(chart?.group_by_field?.includes(':')
      ? { group_by_field: chart.group_by_field.substring(0, chart.group_by_field.indexOf(':')) }
      : {}),
  };

  return hashObject(hashed, {
    respectType: false,
    excludeKeys: key => chart[key] === null,
  });
}
