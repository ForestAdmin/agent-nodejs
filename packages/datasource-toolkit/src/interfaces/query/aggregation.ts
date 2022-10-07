import { DateTime } from 'luxon';
import hashRecord from 'object-hash';

import { RecordData } from '../record';
import Projection from './projection';
import RecordUtils from '../../utils/record';

export type AggregationOperation = 'Count' | 'Sum' | 'Avg' | 'Max' | 'Min';
export type DateOperation = 'Year' | 'Month' | 'Week' | 'Day';

type Summary = {
  group: Record<string, unknown>;
  starCount: number;
  Count: number;
  Sum: number;
  Max: unknown;
  Min: unknown;
};

export interface PlainAggregation {
  field?: string;
  operation: AggregationOperation;
  groups?: Array<{ field: string; operation?: DateOperation }>;
}

type GenericAggregation = {
  field?: string;
  operation: AggregationOperation;
  groups?: Array<{ field: string; operation?: DateOperation }>;
};

export type AggregateResult = { value: unknown; group: RecordData };

export default class Aggregation {
  field?: GenericAggregation['field'];
  operation: GenericAggregation['operation'];
  groups?: GenericAggregation['groups'];

  get projection(): Projection {
    const { field, groups } = this;
    const aggregateFields = [field, ...(groups ?? []).map(b => b.field)].filter(Boolean);

    return new Projection(...aggregateFields);
  }

  constructor(components: GenericAggregation) {
    this.field = components.field;
    this.operation = components.operation;
    this.groups = components.groups;
  }

  apply(records: RecordData[], timezone: string, limit?: number): AggregateResult[] {
    const rows = this.formatSummaries(this.createSummaries(records, timezone));

    rows.sort((r1, r2) => {
      if (r1.value === r2.value) return 0;

      return r1.value < r2.value ? 1 : -1;
    });

    if (limit && rows.length > limit) {
      rows.length = limit;
    }

    return rows;
  }

  nest(prefix: string): Aggregation {
    if (!prefix || prefix.length === 0) {
      return this;
    }

    let nestedField: string;
    let nestedGroups: GenericAggregation['groups'];

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

    return operation === 'Avg'
      ? summaries
          .filter(summary => summary.Count)
          .map(summary => ({
            group: summary.group,
            value: summary.Sum / summary.Count,
          }))
      : summaries.map(summary => ({
          group: summary.group,
          value: operation === 'Count' && !this.field ? summary.starCount : summary[operation],
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
      Count: 0,
      Sum: 0,
      Min: undefined,
      Max: undefined,
    };
  }

  private updateSummaryInPlace(summary: Summary, record: RecordData): void {
    summary.starCount += 1; // i.e: count(*)

    if (this.field) {
      const value = RecordUtils.getFieldValue(record, this.field);

      if (value !== undefined && value !== null) {
        const { Min: min, Max: max } = summary;

        summary.Count += 1; // i.e: count(column)
        if (min === undefined || value < min) summary.Min = value;
        if (max === undefined || value > max) summary.Max = value;
      }

      if (typeof value === 'number' && !Number.isNaN(value)) {
        summary.Sum += value;
      }
    }
  }

  private applyDateOperation(value: string, operation: DateOperation, timezone: string): string {
    if (operation) {
      const dateTime = DateTime.fromISO(value).setZone(timezone);

      if (operation === 'Year') {
        return dateTime.toFormat('yyyy-01-01');
      }

      if (operation === 'Month') {
        return dateTime.toFormat('yyyy-LL-01');
      }

      if (operation === 'Day') {
        return dateTime.toFormat('yyyy-LL-dd');
      }

      if (operation === 'Week') {
        return dateTime.startOf('week').toFormat('yyyy-LL-dd');
      }
    }

    return value;
  }
}
