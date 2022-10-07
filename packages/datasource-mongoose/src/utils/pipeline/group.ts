import { AccumulatorOperator, PipelineStage } from 'mongoose';
import { Aggregation, AggregationOperation, DateOperation } from '@forestadmin/datasource-toolkit';

/** Transform a forest admin aggregation into mongo pipeline */
export default class GroupGenerator {
  private static AGGREGATION_OPERATION: Record<AggregationOperation, string> = {
    Sum: '$sum',
    Avg: '$avg',
    Count: '$sum',
    Max: '$max',
    Min: '$min',
  };

  private static GROUP_OPERATION: Record<DateOperation, string> = {
    Year: '%Y-01-01',
    Month: '%Y-%m-01',
    Day: '%Y-%m-%d',
    Week: '%Y-%m-%d',
  };

  static group(aggregation: Aggregation): PipelineStage[] {
    return [
      {
        $group: {
          _id: this.computeGroups(aggregation.groups),
          value: this.computeValue(aggregation),
        },
      },
      {
        $project: {
          _id: 0,
          value: '$value',
          group: this.computeGroupsProjection(aggregation.groups),
        },
      },
    ];
  }

  /** Compute aggregation value */
  private static computeValue(aggregation: Aggregation): AccumulatorOperator {
    // Handle count(*) case
    if (!aggregation.field) return { $sum: 1 };

    // General case
    const field = `$${aggregation.field.replace(/:/g, '.')}`;

    return aggregation.operation === 'Count'
      ? { $sum: { $cond: [{ $ne: [field, null] }, 1, 0] } }
      : ({
          [this.AGGREGATION_OPERATION[aggregation.operation]]: field,
        } as unknown as AccumulatorOperator);
  }

  /** Compute _id field for the $group pipeline stage */
  private static computeGroups(groups: Aggregation['groups']): unknown {
    return (groups ?? []).reduce((memo, group) => {
      let field: unknown = `$${group.field.replace(/:/g, '.')}`;

      if (group.operation) {
        if (group.operation === 'Week') {
          const date = { $dateTrunc: { date: field, startOfWeek: 'Monday', unit: 'week' } };
          field = { $dateToString: { format: this.GROUP_OPERATION[group.operation], date } };
        } else {
          field = { $dateToString: { format: this.GROUP_OPERATION[group.operation], date: field } };
        }
      }

      return { ...(memo ?? {}), [group.field]: field };
    }, null);
  }

  /** Move fields in _id to the root of the document */
  private static computeGroupsProjection(groups: Aggregation['groups']): unknown {
    return groups?.length
      ? groups.reduce((memo, group) => ({ ...memo, [group.field]: `$_id.${group.field}` }), {})
      : { $literal: {} };
  }
}
