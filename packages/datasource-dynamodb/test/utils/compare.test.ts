import { Aggregation, Sort } from '@forestadmin/datasource-toolkit';

import StreamingAggregator from '../../src/utils/aggregator';
import compareValues from '../../src/utils/compare';
import compareRecords from '../../src/utils/sort';

describe('compareValues', () => {
  it('orders date-times by the instant, not by their text', () => {
    expect(compareValues('2024-01-01T00:30:00+02:00', '2023-12-31T23:00:00Z')).toBe(-1);
  });

  it('compares a date without time as the instant it starts at, in UTC', () => {
    expect(compareValues('2024-01-01', '2024-01-01T00:30:00+02:00')).toBe(1);
    expect(compareValues('2024-01-01', '2024-01-01T00:00:00Z')).toBe(0);
  });

  it('treats the same instant written two ways as equal', () => {
    expect(compareValues('2024-01-01T02:00:00+02:00', '2024-01-01T00:00:00Z')).toBe(0);
  });

  it('orders other strings and numbers as usual', () => {
    expect(compareValues('a', 'b')).toBe(-1);
    expect(compareValues(2, 1)).toBe(1);
    expect(compareValues(1, 1)).toBe(0);
  });
});

describe('sorting and aggregating dates with offsets', () => {
  const earlier = '2024-01-01T00:30:00+02:00';
  const later = '2023-12-31T23:00:00Z';

  it('sorts ascending by instant', () => {
    const sort = new Sort({ field: 'at', ascending: true });
    const records = [{ at: later }, { at: earlier }];

    records.sort((a, b) => compareRecords(a, b, sort));

    expect(records.map(r => r.at)).toEqual([earlier, later]);
  });

  it.each([
    ['Min', earlier],
    ['Max', later],
  ])('takes the %s instant while keeping its text', (operation, expected) => {
    const aggregator = new StreamingAggregator(
      new Aggregation({ operation: operation as 'Min' | 'Max', field: 'at' }),
      'UTC',
    );
    aggregator.add({ at: later });
    aggregator.add({ at: earlier });

    expect(aggregator.result()).toEqual([{ value: expected, group: {} }]);
  });
});
