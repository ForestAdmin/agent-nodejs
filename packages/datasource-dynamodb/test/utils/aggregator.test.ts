import { Aggregation } from '@forestadmin/datasource-toolkit';

import StreamingAggregator from '../../src/utils/aggregator';

function aggregate(
  aggregation: ConstructorParameters<typeof Aggregation>[0],
  records: Record<string, unknown>[],
  options: { timezone?: string; limit?: number } = {},
) {
  const aggregator = new StreamingAggregator(
    new Aggregation(aggregation),
    options.timezone ?? 'UTC',
  );
  records.forEach(record => aggregator.add(record));

  return aggregator.result(options.limit);
}

describe('StreamingAggregator', () => {
  describe('without groups', () => {
    it('counts every record when no field is given', () => {
      expect(aggregate({ operation: 'Count' }, [{ a: 1 }, { a: null }, {}])).toEqual([
        { value: 3, group: {} },
      ]);
    });

    it('counts only the records having a value for the field', () => {
      expect(aggregate({ operation: 'Count', field: 'a' }, [{ a: 1 }, { a: null }, {}])).toEqual([
        { value: 1, group: {} },
      ]);
    });

    it('sums numbers and ignores other values', () => {
      expect(
        aggregate({ operation: 'Sum', field: 'a' }, [{ a: 1 }, { a: 2.5 }, { a: 'x' }]),
      ).toEqual([{ value: 3.5, group: {} }]);
    });

    it('averages over the records having a number', () => {
      expect(
        aggregate({ operation: 'Avg', field: 'a' }, [{ a: 2 }, { a: 4 }, { a: null }]),
      ).toEqual([{ value: 3, group: {} }]);
    });

    it('takes the min and the max', () => {
      const records = [{ a: 3 }, { a: 1 }, { a: 2 }];

      expect(aggregate({ operation: 'Min', field: 'a' }, records)).toEqual([
        { value: 1, group: {} },
      ]);
      expect(aggregate({ operation: 'Max', field: 'a' }, records)).toEqual([
        { value: 3, group: {} },
      ]);
    });

    it('returns zero for a count or a sum over nothing', () => {
      expect(aggregate({ operation: 'Count' }, [])).toEqual([{ value: 0, group: {} }]);
      expect(aggregate({ operation: 'Sum', field: 'a' }, [])).toEqual([{ value: 0, group: {} }]);
    });

    it('returns null for an average, min or max over nothing', () => {
      expect(aggregate({ operation: 'Avg', field: 'a' }, [])).toEqual([{ value: null, group: {} }]);
      expect(aggregate({ operation: 'Max', field: 'a' }, [])).toEqual([{ value: null, group: {} }]);
    });
  });

  describe('with groups', () => {
    it('groups on one field and sorts by value, highest first', () => {
      const result = aggregate({ operation: 'Count', groups: [{ field: 's' }] }, [
        { s: 'a' },
        { s: 'b' },
        { s: 'b' },
      ]);

      expect(result).toEqual([
        { value: 2, group: { s: 'b' } },
        { value: 1, group: { s: 'a' } },
      ]);
    });

    it('groups on several fields', () => {
      const result = aggregate(
        { operation: 'Sum', field: 'n', groups: [{ field: 'a' }, { field: 'b' }] },
        [
          { a: 1, b: 'x', n: 1 },
          { a: 1, b: 'x', n: 2 },
          { a: 1, b: 'y', n: 5 },
        ],
      );

      expect(result).toEqual([
        { value: 5, group: { a: 1, b: 'y' } },
        { value: 3, group: { a: 1, b: 'x' } },
      ]);
    });

    it('keeps falsy group keys', () => {
      const result = aggregate({ operation: 'Count', groups: [{ field: 'k' }] }, [
        { k: 0 },
        { k: '' },
        { k: false },
      ]);

      expect(result.map(r => r.group.k).sort()).toEqual(['', 0, false].sort());
    });

    it('groups missing values under null', () => {
      const result = aggregate({ operation: 'Count', groups: [{ field: 'k' }] }, [{}, { k: null }]);

      expect(result).toEqual([{ value: 2, group: { k: null } }]);
    });

    it('truncates to the limit after sorting', () => {
      const result = aggregate(
        { operation: 'Count', groups: [{ field: 's' }] },
        [{ s: 'a' }, { s: 'b' }, { s: 'b' }, { s: 'c' }, { s: 'c' }, { s: 'c' }],
        { limit: 2 },
      );

      expect(result.map(r => r.group.s)).toEqual(['c', 'b']);
    });

    it('reads flattened nested fields by their arrow path', () => {
      const result = aggregate({ operation: 'Count', groups: [{ field: 'address->city' }] }, [
        { 'address->city': 'Paris' },
        { 'address->city': 'Paris' },
      ]);

      expect(result).toEqual([{ value: 2, group: { 'address->city': 'Paris' } }]);
    });

    it('averages per group', () => {
      const result = aggregate({ operation: 'Avg', field: 'n', groups: [{ field: 'g' }] }, [
        { g: 'a', n: 2 },
        { g: 'a', n: 4 },
        { g: 'b', n: 10 },
      ]);

      expect(result).toEqual([
        { value: 10, group: { g: 'b' } },
        { value: 3, group: { g: 'a' } },
      ]);
    });
  });

  describe('date groups', () => {
    const dates = [
      { at: '2024-01-15T10:00:00Z' },
      { at: '2024-01-20T23:30:00Z' },
      { at: '2024-03-02T01:00:00Z' },
    ];

    it.each([
      ['Year', ['2024-01-01']],
      ['Quarter', ['2024-01-01']],
      ['Month', ['2024-01-01', '2024-03-01']],
      ['Day', ['2024-01-15', '2024-01-20', '2024-03-02']],
      ['Week', ['2024-01-15', '2024-02-26']],
    ])('buckets by %s', (operation, expected) => {
      const result = aggregate(
        { operation: 'Count', groups: [{ field: 'at', operation: operation as never }] },
        dates,
      );

      expect(result.map(r => r.group.at).sort()).toEqual([...expected].sort());
    });

    it('buckets in the requested timezone', () => {
      const result = aggregate(
        { operation: 'Count', groups: [{ field: 'at', operation: 'Day' }] },
        [{ at: '2024-01-20T23:30:00Z' }],
        { timezone: 'Asia/Tokyo' },
      );

      expect(result[0].group.at).toBe('2024-01-21');
    });

    it('accepts epoch milliseconds and seconds', () => {
      const result = aggregate(
        { operation: 'Count', groups: [{ field: 'at', operation: 'Day' }] },
        [{ at: Date.UTC(2024, 0, 15, 10) }, { at: Date.UTC(2024, 0, 15, 12) / 1000 }],
      );

      expect(result).toEqual([{ value: 2, group: { at: '2024-01-15' } }]);
    });

    it('groups an unparsable date under null', () => {
      const result = aggregate(
        { operation: 'Count', groups: [{ field: 'at', operation: 'Day' }] },
        [{ at: 'not a date' }],
      );

      expect(result).toEqual([{ value: 1, group: { at: null } }]);
    });
  });
});
