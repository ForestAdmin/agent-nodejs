import { DateTime } from 'luxon';
import hashRecord from 'object-hash';

import { RecordData } from '../record';
import Projection from './projection';
import RecordUtils from '../../utils/record';

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
  value: unknown;
  group: { [field: string]: unknown };
};

type Summary = {
  group: Record<string, unknown>;
  starCount: number;
  [AggregationOperation.Count]: number;
  [AggregationOperation.Sum]: number;
  [AggregationOperation.Max]: unknown;
  [AggregationOperation.Min]: unknown;
};

interface AggregationComponents {
  field?: string;
  operation: AggregationOperation;
  groups?: AggregationGroup[];
}

interface AggregationGroup {
  field: string;
  operation?: DateOperation;
}

export default class Aggregation implements AggregationComponents {
  field?: string;
  operation: AggregationOperation;
  groups?: AggregationGroup[];

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

  apply(records: RecordData[], timezone: string): AggregateResult[] {
    return this.formatSummaries(this.createSummaries(records, timezone));
  }

  nest(prefix: string): Aggregation {
    if (!prefix || prefix.length === 0) {
      return this;
    }

    let nestedField: string;
    let nestedGroups: AggregationGroup[];

    if (this.field) {
      nestedField = `${prefix}:${this.field}`;
    }

    if (this.groups)
      nestedGroups = this.groups.map(bucket => ({
        field: `${prefix}:${bucket.field}`,
        operation: bucket.operation,
      }));

    return new Aggregation({ field: nestedField, operation: this.operation, groups: nestedGroups });
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

  private createSummaries(records: RecordData[], timezone: string): Array<Summary> {
    const groupingMap: Record<string, Summary> = {};

    for (const record of records) {
      const group = this.createGroup(record, timezone);
      const uniqueKey = hashRecord(group);
      const summary = groupingMap[uniqueKey] ?? this.createSummary(group);

      this.updateSummaryInPlace(summary, record);

      groupingMap[uniqueKey] = summary;
    }

    return Object.values(groupingMap);
  }

  private formatSummaries(summaries: Summary[]): AggregateResult[] {
    const { operation } = this;

    return operation === AggregationOperation.Average
      ? summaries
          .filter(summary => summary[AggregationOperation.Count])
          .map(summary => ({
            group: summary.group,
            value: summary[AggregationOperation.Sum] / summary[AggregationOperation.Count],
          }))
      : summaries.map(summary => ({
          group: summary.group,
          value:
            operation === AggregationOperation.Count && !this.field
              ? summary.starCount
              : summary[operation],
        }));
  }

  private createGroup(record: RecordData, timezone: string): RecordData {
    const group: RecordData = {};

    for (const { field, operation } of this.groups ?? []) {
      const groupValue = RecordUtils.getFieldValue(record, field) as string;
      group[field] = this.applyDateOperation(groupValue, operation, timezone);
    }

    return group;
  }

  private createSummary(group: RecordData): Summary {
    return {
      group,
      starCount: 0,
      [AggregationOperation.Count]: 0,
      [AggregationOperation.Sum]: 0,
      [AggregationOperation.Min]: undefined,
      [AggregationOperation.Max]: undefined,
    };
  }

  private updateSummaryInPlace(summary: Summary, record: RecordData): void {
    summary.starCount += 1; // i.e: count(*)

    if (this.field) {
      const value = RecordUtils.getFieldValue(record, this.field);

      if (value !== undefined && value !== null) {
        const { [AggregationOperation.Min]: min, [AggregationOperation.Max]: max } = summary;

        summary[AggregationOperation.Count] += 1; // i.e: count(column)
        if (min === undefined || value < min) summary[AggregationOperation.Min] = value;
        if (max === undefined || value > max) summary[AggregationOperation.Max] = value;
      }

      if (typeof value === 'number' && !Number.isNaN(value)) {
        summary[AggregationOperation.Sum] += value;
      }
    }
  }

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

    return value;
  }
}
