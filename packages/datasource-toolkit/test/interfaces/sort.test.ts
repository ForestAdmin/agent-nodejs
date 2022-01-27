import Sort from '../../dist/interfaces/query/sort';

describe('Sort', () => {
  const sort = new Sort(
    { field: 'column1', ascending: true },
    { field: 'column2', ascending: false },
  );

  test('projection should work', () => {
    expect(sort.projection).toEqual(['column1', 'column2']);
  });

  test('replaceClauses should work when returning a single clause', () => {
    expect(sort.replaceClauses(clause => ({ ...clause, ascending: !clause.ascending }))).toEqual([
      { field: 'column1', ascending: false },
      { field: 'column2', ascending: true },
    ]);
  });

  test('replaceClauses should work when returning multiple clause', () => {
    expect(
      sort.replaceClauses(clause =>
        clause.field === 'column1' ? [clause, { field: 'otherCol', ascending: true }] : clause,
      ),
    ).toEqual([
      { field: 'column1', ascending: true },
      { field: 'otherCol', ascending: true },
      { field: 'column2', ascending: false },
    ]);
  });

  test('nest should work', () => {
    expect(sort.nest('prefix')).toEqual([
      { field: 'prefix:column1', ascending: true },
      { field: 'prefix:column2', ascending: false },
    ]);
  });

  test('unnest should work', () => {
    expect(sort.nest('prefix').unnest()).toEqual(sort);
  });

  test('unnest should fail when no common prefix exists', () => {
    expect(() => sort.unnest()).toThrow('Cannot unnest sort.');
  });

  test('apply should work', () => {
    const records = [
      { column1: 2, column2: 2 },
      { column1: 1, column2: 1 },
      { column1: 1, column2: 1 },
      { column1: 1, column2: 2 },
      { column1: 2, column2: 1 },
    ];

    expect(sort.apply(records)).toStrictEqual([
      { column1: 1, column2: 2 },
      { column1: 1, column2: 1 },
      { column1: 1, column2: 1 },
      { column1: 2, column2: 2 },
      { column1: 2, column2: 1 },
    ]);
  });
});
