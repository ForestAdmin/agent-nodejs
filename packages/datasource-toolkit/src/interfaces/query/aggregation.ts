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
  toDay = 'Day',
}

export type Aggregation = {
  field?: string;
  operation: AggregationOperation;
  ascending?: boolean;

  groups?: Array<{
    field: string;
    operation?: DateOperation;
  }>;
};

export type AggregateResult = {
  value: number;
  group: { [field: string]: string };
};
