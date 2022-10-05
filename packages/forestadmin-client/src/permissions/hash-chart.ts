import hashObject from 'object-hash';

import {
  AggregatedChart,
  Chart,
  ChartType,
  CollectionChart,
  FilterableChart,
  GroupedByChart,
  LeaderboardChart,
  LineChart,
  QueryChart,
} from './types';

export function hashServerCharts(charts: Chart[]): Set<string> {
  const frontendCharts = charts
    // Query charts are not supported
    .filter(x => !(x as QueryChart).query)
    .map(chart => ({
      type: chart.type,
      filters: (chart as FilterableChart).filter,
      aggregate: (chart as AggregatedChart).aggregator,
      aggregate_field: (chart as AggregatedChart).aggregateFieldName,
      collection: (chart as CollectionChart).sourceCollectionId,
      time_range: (chart as LineChart).timeRange,
      group_by_date_field:
        (chart.type === ChartType.Line && (chart as LineChart).groupByFieldName) || null,
      group_by_field:
        (chart.type !== ChartType.Line && (chart as GroupedByChart).groupByFieldName) || null,
      limit: (chart as LeaderboardChart).limit,
      label_field: (chart as LeaderboardChart).labelFieldName,
      relationship_field: (chart as LeaderboardChart).relationshipFieldName,
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
