import Aggregation, {
  AggregationOperation,
  DateOperation,
} from '../../src/interfaces/query/aggregation';

describe('Aggregation', () => {
  describe('count(*) with no grouping', () => {
    const aggregation = new Aggregation({
      operation: AggregationOperation.Count,
    });

    test('projection should work', () => {
      expect(aggregation.projection).toEqual([]);
    });

    test('apply should work', () => {
      const records = [{}, {}, {}, {}, {}];
      expect(aggregation.apply(records, 'Europe/Paris')).toEqual([{ value: 5, group: {} }]);
    });
  });

  describe('count(column) with simple grouping', () => {
    const aggregation = new Aggregation({
      operation: AggregationOperation.Count,
      field: 'id',
      groups: [{ field: 'discriminant' }],
    });

    test('replaceFields should work', () => {
      expect(aggregation.replaceFields(field => `prefix:${field}`)).toEqual({
        operation: AggregationOperation.Count,
        field: 'prefix:id',
        groups: [{ field: 'prefix:discriminant' }],
      });
    });

    test('projection should work', () => {
      expect(aggregation.projection).toEqual(['id', 'discriminant']);
    });

    test('apply should work', () => {
      const records = [
        { id: 1, discriminant: 'blue' },
        { id: 1, discriminant: 'blue' },
        { id: 1, discriminant: 'blue' },
        { id: 1, discriminant: 'red' },
        { id: null, discriminant: 'red' },
      ];

      expect(aggregation.apply(records, 'Europe/Paris')).toEqual([
        { value: 3, group: { discriminant: 'blue' } },
        { value: 1, group: { discriminant: 'red' } },
      ]);
    });

    test('nest() should nest the field and the group fields by adding a prefix', () => {
      expect(aggregation.nest('prefix')).toEqual(
        new Aggregation({
          operation: AggregationOperation.Count,
          field: 'prefix:id',
          groups: [{ field: 'prefix:discriminant' }],
        }),
      );
    });
  });

  describe('count(*) with simple grouping', () => {
    const aggregation = new Aggregation({
      operation: AggregationOperation.Count,
      groups: [{ field: 'discriminant' }],
    });

    test('apply should work', () => {
      const records = [
        { id: 1, discriminant: 'blue' },
        { id: 1, discriminant: 'blue' },
        { id: 1, discriminant: 'blue' },
        { id: 1, discriminant: 'red' },
        { id: null, discriminant: 'red' },
      ];

      expect(aggregation.apply(records, 'Europe/Paris')).toEqual([
        { value: 3, group: { discriminant: 'blue' } },
        { value: 2, group: { discriminant: 'red' } },
      ]);
    });
  });

  describe('sum with ToYear grouping', () => {
    const aggregation = new Aggregation({
      operation: AggregationOperation.Sum,
      field: 'id',
      groups: [{ field: 'discriminant', operation: DateOperation.ToYear }],
    });

    test('apply should work', () => {
      const records = [
        { id: 2, discriminant: '2010-01-01T12:00:00Z' },
        { id: null, discriminant: '2021-06-23T12:00:00Z' },
        { id: 2, discriminant: '2010-01-01T12:00:00Z' },
        { id: 2, discriminant: '2010-07-01T12:00:00Z' },
        { id: 1, discriminant: '2021-04-01T12:00:00Z' },
      ];

      expect(aggregation.apply(records, 'Europe/Paris')).toEqual([
        { value: 6, group: { discriminant: '2010-01-01' } },
        { value: 1, group: { discriminant: '2021-01-01' } },
      ]);
    });
  });

  describe('average with toMonth grouping', () => {
    const aggregation = new Aggregation({
      operation: AggregationOperation.Average,
      field: 'id',
      groups: [{ field: 'discriminant', operation: DateOperation.ToMonth }],
    });

    test('apply should not show empty groups', () => {
      const records = [
        { id: 3, discriminant: '2010-01-01T12:00:00Z' },
        { id: null, discriminant: '2021-06-23T12:00:00Z' },
        { id: 2, discriminant: '2010-01-01T12:00:00Z' },
        { id: 2, discriminant: '2010-07-01T12:00:00Z' },
        { id: 1, discriminant: '2021-04-01T12:00:00Z' },
      ];

      expect(aggregation.apply(records, 'Europe/Paris')).toEqual([
        { value: 2.5, group: { discriminant: '2010-01-01' } },
        { value: 2, group: { discriminant: '2010-07-01' } },
        { value: 1, group: { discriminant: '2021-04-01' } },
      ]);
    });
  });

  describe('count with ToDay grouping', () => {
    const aggregation = new Aggregation({
      operation: AggregationOperation.Count,
      groups: [{ field: 'discriminant', operation: DateOperation.ToDay }],
    });

    test('apply should work', () => {
      const records = [
        { id: 2, discriminant: '2010-07-01T12:00:00Z' },
        { id: 1, discriminant: '2021-04-01T12:00:00Z' },
      ];

      expect(aggregation.apply(records, 'Europe/Paris')).toEqual([
        { value: 1, group: { discriminant: '2010-07-01' } },
        { value: 1, group: { discriminant: '2021-04-01' } },
      ]);
    });
  });

  describe('count with ToWeek grouping', () => {
    const aggregation = new Aggregation({
      operation: AggregationOperation.Count,
      groups: [{ field: 'discriminant', operation: DateOperation.ToWeek }],
    });

    test('apply should work', () => {
      const records = [
        { id: 2, discriminant: '2010-07-01T12:00:00Z' },
        { id: 1, discriminant: '2021-04-01T12:00:00Z' },
      ];

      expect(aggregation.apply(records, 'Europe/Paris')).toEqual([
        // Those are mondays
        { value: 1, group: { discriminant: '2010-06-28' } },
        { value: 1, group: { discriminant: '2021-03-29' } },
      ]);
    });
  });
});
