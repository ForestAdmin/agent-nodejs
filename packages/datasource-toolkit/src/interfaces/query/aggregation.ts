import { DateTime } from 'luxon';
import RecordUtils from '../../utils/record';
import { RecordData } from '../record';
import Projection from './projection';

export enum AggregationOperation {
  Count = 'Count',
  Sum = 'Sum',
  Average = 'Avg',
  Max = 'Max',
  Min = 'Min',
}

export enum DateOperation {
  ToYear = 'Year',
  ToMonth = 'Month',
  ToWeek = 'Week',
  ToDay = 'Day',
}

export type AggregateResult = {
  value: number;
  group: { [field: string]: unknown };
};

interface AggregationComponents {
  field?: string;
  operation: AggregationOperation;
  groups?: Array<{ field: string; operation?: DateOperation }>;
}

export default class Aggregation implements AggregationComponents {
  field?: string;
  operation: AggregationOperation;
  groups?: { field: string; operation?: DateOperation }[];

  get projection(): Projection {
    const { field, groups } = this;
    const aggregateFields = [field, ...(groups ?? []).map(b => b.field)].filter(Boolean);

    return new Projection(...aggregateFields);
  }

  constructor(components: AggregationComponents) {
    this.field = components.field;
    this.operation = components.operation;
    this.groups = components.groups;
  }

  replaceFields(handler: (field: string) => string): Aggregation {
    const result = new Aggregation(this);

    if (result.field) {
      result.field = handler(result.field);
    }

    result.groups = result.groups?.map(({ field, operation }) => ({
      field: handler(field),
      operation,
    }));

    return result;
  }

  apply(records: RecordData[], timezone: string): AggregateResult[] {
    const rows = this.regroup(records, timezone);

    if (this.operation === AggregationOperation.Average) {
      return rows
        .filter(({ count }) => count)
        .map(({ sum, count, group }) => ({ value: sum / count, group }));
    }

    if (this.operation === AggregationOperation.Sum) {
      return rows.map(({ sum, group }) => ({ value: sum, group }));
    }

    return rows.map(({ count, starCount, group }) => ({
      value: this.field ? count : starCount,
      group,
    }));
  }

  private regroup(
    records: RecordData[],
    timezone: string,
  ): Array<{ sum: number; count: number; starCount: number; group: Record<string, unknown> }> {
    // Group records according to buckets.
    const groupingMap = {};

    for (const record of records) {
      // Compute grouping values & key
      const intermediaryResult = { count: 0, starCount: 0, sum: 0, group: {} };
      let uniqueKey = '';

      for (const { field, operation } of this.groups ?? []) {
        const baseValue = RecordUtils.getFieldValue(record, field) as string;
        const value = this.applyDateOperation(baseValue, operation, timezone);
        intermediaryResult.group[field] = value;
        uniqueKey += `--${value}`;
      }

      // First match => store result
      if (!groupingMap[uniqueKey]) {
        groupingMap[uniqueKey] = intermediaryResult;
      }

      // Increment counters
      groupingMap[uniqueKey].starCount += 1; // i.e: count(*)

      if (this.field) {
        const aggregateValue = RecordUtils.getFieldValue(record, this.field);

        if (aggregateValue !== undefined && aggregateValue !== null) {
          groupingMap[uniqueKey].count += 1; // i.e: count(column)
          groupingMap[uniqueKey].sum += aggregateValue;
        }
      }
    }

    return Object.values(groupingMap);
  }

  /** Used for aggregation emulation layer */
  private applyDateOperation(value: string, operation: DateOperation, timezone: string): string {
    if (operation) {
      const dateTime = DateTime.fromISO(value).setZone(timezone);

      if (operation === DateOperation.ToYear) {
        return dateTime.toFormat('yyyy-01-01');
      }

      if (operation === DateOperation.ToMonth) {
        return dateTime.toFormat('yyyy-LL-01');
      }

      if (operation === DateOperation.ToDay) {
        return dateTime.toFormat('yyyy-LL-dd');
      }

      if (operation === DateOperation.ToWeek) {
        return dateTime.startOf('week').toFormat('yyyy-LL-dd');
      }
    }

    return String(value);
  }
}
