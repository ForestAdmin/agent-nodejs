import type {
  AggregateResult,
  Aggregation,
  DateOperation,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import compareValues from './compare';

/** Numbers below this are epoch seconds: in milliseconds they would be before 1973. */
const EPOCH_SECONDS_CEILING = 1e11;
const MONTHS_PER_QUARTER = 3;
const DAYS_PER_WEEK = 7;

type Accumulator = {
  group: RecordData;
  records: number;
  values: number;
  numbers: number;
  sum: number;
  min: unknown;
  max: unknown;
};

function toDate(value: unknown): Date | null {
  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    date = new Date(value < EPOCH_SECONDS_CEILING ? value * 1000 : value);
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else {
    return null;
  }

  return Number.isNaN(date.getTime()) ? null : date;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function localDay(date: Date, timezone: string): { year: number; month: number; day: number } {
  let formatter = formatters.get(timezone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timezone, formatter);
  }

  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));

  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

const two = (n: number) => String(n).padStart(2, '0');

function dateBucket(value: unknown, operation: DateOperation, timezone: string): string | null {
  const date = toDate(value);

  if (!date) return null;

  const { year, month, day } = localDay(date, timezone);

  switch (operation) {
    case 'Year':
      return `${year}-01-01`;
    case 'Quarter':
      return `${year}-${two(
        Math.floor((month - 1) / MONTHS_PER_QUARTER) * MONTHS_PER_QUARTER + 1,
      )}-01`;
    case 'Month':
      return `${year}-${two(month)}-01`;

    case 'Week': {
      const monday = new Date(Date.UTC(year, month - 1, day));
      monday.setUTCDate(
        monday.getUTCDate() - ((monday.getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK),
      );

      return monday.toISOString().slice(0, 10);
    }

    default:
      return `${year}-${two(month)}-${two(day)}`;
  }
}

/**
 * DynamoDB cannot aggregate, so records are reduced here as they are read, group by group,
 * without ever holding the whole table.
 */
export default class StreamingAggregator {
  private readonly accumulators = new Map<string, Accumulator>();

  constructor(private readonly aggregation: Aggregation, private readonly timezone: string) {}

  add(record: RecordData): void {
    const group: RecordData = {};

    for (const { field, operation } of this.aggregation.groups ?? []) {
      const value = record[field] ?? null;
      group[field] = operation ? dateBucket(value, operation, this.timezone) : value;
    }

    const key = JSON.stringify(Object.values(group));
    let accumulator = this.accumulators.get(key);

    if (!accumulator) {
      accumulator = this.emptyAccumulator(group);
      this.accumulators.set(key, accumulator);
    }

    accumulator.records += 1;

    if (!this.aggregation.field) return;

    const value = record[this.aggregation.field];

    if (value === undefined || value === null) return;

    accumulator.values += 1;

    if (accumulator.min === undefined || compareValues(value, accumulator.min) < 0) {
      accumulator.min = value;
    }

    if (accumulator.max === undefined || compareValues(value, accumulator.max) > 0) {
      accumulator.max = value;
    }

    if (typeof value === 'number' && !Number.isNaN(value)) {
      accumulator.numbers += 1;
      accumulator.sum += value;
    }
  }

  result(limit?: number): AggregateResult[] {
    const accumulators = [...this.accumulators.values()];

    if (accumulators.length === 0 && !this.aggregation.groups?.length) {
      accumulators.push(this.emptyAccumulator({}));
    }

    const rows = accumulators.map(accumulator => ({
      group: accumulator.group,
      value: this.valueOf(accumulator),
    }));

    rows.sort((a, b) => {
      if (a.value === b.value) return 0;
      if (a.value === null) return 1;
      if (b.value === null) return -1;

      return a.value < b.value ? 1 : -1;
    });

    return limit && rows.length > limit ? rows.slice(0, limit) : rows;
  }

  private emptyAccumulator(group: RecordData): Accumulator {
    return {
      group,
      records: 0,
      values: 0,
      numbers: 0,
      sum: 0,
      min: undefined,
      max: undefined,
    };
  }

  private valueOf(accumulator: Accumulator): unknown {
    switch (this.aggregation.operation) {
      case 'Count':
        return this.aggregation.field ? accumulator.values : accumulator.records;
      case 'Sum':
        return accumulator.sum;
      case 'Avg':
        return accumulator.numbers ? accumulator.sum / accumulator.numbers : null;
      case 'Min':
        return accumulator.min ?? null;
      default:
        return accumulator.max ?? null;
    }
  }
}
