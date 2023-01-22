import { AggregationsAggregationContainer } from '@elastic/elasticsearch/api/types';
import {
  AggregateResult,
  Aggregation,
  AggregationOperation,
  DateOperation,
} from '@forestadmin/datasource-toolkit';

import Serializer from './serializer';

export default class AggregationUtils {
  private static AGGREGATION_OPERATION: Record<AggregationOperation, string> = {
    Sum: 'sum',
    Avg: 'avg',
    Count: 'value_count',
    Max: 'max',
    Min: 'min',
  };

  private static GROUP_OPERATION: Record<
    DateOperation,
    { calendar_interval: string; format: string }
  > = {
    Year: { calendar_interval: 'year', format: 'yyy-MM-dd' },
    // Quarter: { calendar_interval: 'quarter', format: 'yyy-Q' },
    Month: { calendar_interval: 'month', format: 'yyy-MM-dd' },
    Week: { calendar_interval: 'week', format: 'yyy-MM-dd' },
    Day: { calendar_interval: 'day', format: 'yyy-MM-dd' },
  };

  static aggs(aggregation: Aggregation): Record<string, AggregationsAggregationContainer> {
    const metricsAggregations = this.computeValue(aggregation);
    const groupsAggregations = this.computeGroups(aggregation.groups);

    return {
      ...(metricsAggregations ? { metricsAggregations } : {}),
      ...(groupsAggregations ? { groupsAggregations } : {}),
    };
  }

  /** Compute aggregation value */
  private static computeValue(aggregation: Aggregation): AggregationsAggregationContainer {
    // Handle count(*) case
    if (!aggregation.field) return { global: {} };

    // General case
    return {
      [this.AGGREGATION_OPERATION[aggregation.operation]]: aggregation.field,
    };
  }

  /** Compute field for the Bucket aggregations stage */
  private static computeGroups(groups: Aggregation['groups']): unknown {
    return groups?.reduce((memo, group) => {
      let bucketAggregation;
      const { field, operation } = group;

      if (operation) {
        bucketAggregation = {
          date_histogram: { ...this.GROUP_OPERATION[operation], field },
        };
      }

      return { ...memo, ...bucketAggregation };
    }, {});
  }

  static computeResult(
    aggregationResults: Record<string, unknown>,
    groups: Aggregation['groups'],
  ): AggregateResult[] {
    if (aggregationResults.metricsAggregations && !aggregationResults.groupsAggregations)
      return [
        {
          value: (aggregationResults.metricsAggregations as { doc_count: number })?.doc_count,
          group: {},
        },
      ];

    const { buckets } = aggregationResults.groupsAggregations as {
      buckets: { key_as_string: string; key: Date; doc_count: number }[];
    };

    return buckets.map(({ key_as_string, doc_count }) => {
      return {
        value: Serializer.serializeValue(doc_count),
        group: (groups ?? []).reduce((memo, { field }) => {
          memo[field] = key_as_string;

          return memo;
        }, {}),
      };
    });
  }
}
