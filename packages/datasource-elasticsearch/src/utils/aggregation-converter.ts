import { AggregationsAggregationContainer, double } from '@elastic/elasticsearch/api/types';
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

  static aggs(
    aggregation: Aggregation,
    filter: unknown,
    limit?: number,
  ): Record<string, AggregationsAggregationContainer> {
    const metricsAggregations = this.computeValue(aggregation, filter);
    const groupsAggregations = this.computeGroups(aggregation, limit);

    if (aggregation.groups) {
      return { groupsAggregations };
    }

    return {
      metricsAggregations,
    };
  }

  /** Compute aggregation value */
  private static computeValue(
    aggregation: Aggregation,
    filter?: unknown,
  ): AggregationsAggregationContainer {
    if (!aggregation.field) {
      // TODO TEST: Rework -> doc_count is computed in every search responses no need
      // to put back the filter in here
      // Handle count(*) case (affected by global filters)
      if (filter) {
        return { filter };
      }

      // TODO: Rework this count(*) -> doc_count is computed in every search responses
      // Handle count(*) case (not affected by any global filters)
      return { global: {} };
    }

    // General case
    return {
      [this.AGGREGATION_OPERATION[aggregation.operation]]: { field: aggregation.field },
    };
  }

  /** Compute field for the Bucket aggregations stage */
  private static computeGroups(aggregation: Aggregation, limit?: number): unknown {
    return aggregation.groups?.reduce((memo, group) => {
      let bucketAggregation;
      const { field, operation } = group;

      if (operation) {
        bucketAggregation = {
          date_histogram: { ...this.GROUP_OPERATION[operation], field },
        };
      } else if (field) {
        bucketAggregation = {
          terms: { field, size: limit ?? 10 },
          ...(aggregation.operation !== 'Count'
            ? { aggs: { operation: AggregationUtils.computeValue(aggregation) } }
            : {}),
        };
      }

      return { ...memo, ...bucketAggregation };
    }, {});
  }

  static computeResult(
    aggregationResults: Record<string, unknown>,
    aggregation: Aggregation,
  ): AggregateResult[] {
    if (aggregationResults.metricsAggregations && !aggregationResults.groupsAggregations)
      return [
        {
          value: AggregationUtils.computeAggregationResult(
            aggregationResults.metricsAggregations,
            aggregation,
          ),
          group: {},
        },
      ];

    const { buckets } = aggregationResults.groupsAggregations as {
      buckets: {
        key_as_string: string;
        key: string;
        doc_count: number;
        operation?: { doc_count: number; value: number | double };
      }[];
    };

    return buckets.map(({ key, key_as_string, doc_count, operation }) => {
      return {
        value: operation
          ? AggregationUtils.computeAggregationResult(operation, aggregation)
          : Serializer.serializeValue(doc_count),
        group: (aggregation.groups ?? []).reduce((memo, { field }) => {
          memo[field] = key_as_string ?? key;

          return memo;
        }, {}),
      };
    });
  }

  static computeAggregationResult(aggregationResults: unknown, aggregation: Aggregation): unknown {
    switch (aggregation.operation) {
      case 'Count':
        return (aggregationResults as { doc_count: number })?.doc_count;

      default:
        return (aggregationResults as { value: number | double })?.value;
    }
  }
}
