import ConditionTreeBranch, { Aggregator } from '../../dist/interfaces/query/condition-tree/branch';
import ConditionTreeLeaf, { Operator } from '../../dist/interfaces/query/condition-tree/leaf';
import ConditionTreeNot from '../../dist/interfaces/query/condition-tree/not';

describe('ConditionTree', () => {
  const tree = new ConditionTreeBranch(Aggregator.And, [
    new ConditionTreeLeaf({ field: 'column1', operator: Operator.Equal, value: true }),
    new ConditionTreeLeaf({ field: 'column2', operator: Operator.Equal, value: true }),
    new ConditionTreeNot(
      new ConditionTreeLeaf({ field: 'column2', operator: Operator.Equal, value: false }),
    ),
  ]);

  test('apply() should work', () => {
    const records = [
      { id: 1, column1: true, column2: true },
      { id: 2, column1: false, column2: true },
      { id: 3, column1: true, column2: false },
    ];

    expect(tree.apply(records)).toStrictEqual([{ id: 1, column1: true, column2: true }]);
  });

  test('everyLeaf() should work', () => {
    expect(tree.everyLeaf(leaf => leaf.value === true)).toBe(false);
    expect(tree.everyLeaf(leaf => leaf.field === 'column1')).toBe(false);
    expect(tree.everyLeaf(leaf => leaf.field.startsWith('column'))).toBe(true);
  });

  test('forEachLeaf() should work', () => {
    const fn = jest.fn();

    tree.forEachLeaf(fn);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenCalledWith(tree.conditions[0]);
    expect(fn).toHaveBeenCalledWith(tree.conditions[1]);
    expect(fn).toHaveBeenCalledWith((tree.conditions[2] as ConditionTreeNot).condition);
  });

  test('inverse() should work', () => {
    expect(tree.inverse()).toEqual({
      aggregator: Aggregator.Or,
      conditions: [
        { field: 'column1', operator: Operator.NotEqual, value: true },
        { field: 'column2', operator: Operator.NotEqual, value: true },
        { field: 'column2', operator: Operator.Equal, value: false },
      ],
    });

    expect(tree.inverse().inverse()).toEqual({
      aggregator: Aggregator.And,
      conditions: [
        { field: 'column1', operator: Operator.Equal, value: true },
        { field: 'column2', operator: Operator.Equal, value: true },
        { field: 'column2', operator: Operator.NotEqual, value: false },
      ],
    });
  });

  test('inverse() should work with blank', () => {
    const blank = new ConditionTreeLeaf({ field: 'column1', operator: Operator.Blank });

    expect(blank.inverse()).toEqual({ field: 'column1', operator: Operator.Present });
    expect(blank.inverse().inverse()).toEqual(blank);
  });

  test('inverse() should use not with unsupported operator', () => {
    const today = new ConditionTreeLeaf({ field: 'column1', operator: Operator.Today });

    expect(today.inverse()).toEqual({
      condition: { field: 'column1', operator: Operator.Today },
    });
  });

  test('match() should work', () => {
    expect(tree.match({ column1: true, column2: true })).toBeTruthy();
    expect(tree.match({ column1: false, column2: true })).toBeFalsy();

    expect(tree.inverse().match({ column1: true, column2: true })).toBeFalsy();
    expect(tree.inverse().match({ column1: false, column2: true })).toBeTruthy();
  });

  test('match() should work with many operators', () => {
    const allConditions = new ConditionTreeBranch(Aggregator.And, [
      new ConditionTreeLeaf({ field: 'string', operator: Operator.Present }),
      new ConditionTreeLeaf({ field: 'string', operator: Operator.Contains, value: 'value' }),
      new ConditionTreeLeaf({ field: 'string', operator: Operator.StartsWith, value: 'value' }),
      new ConditionTreeLeaf({ field: 'string', operator: Operator.EndsWith, value: 'value' }),
      new ConditionTreeLeaf({ field: 'string', operator: Operator.LessThan, value: 'valuf' }),
      new ConditionTreeLeaf({ field: 'string', operator: Operator.Equal, value: 'value' }),
      new ConditionTreeLeaf({ field: 'string', operator: Operator.GreaterThan, value: 'valud' }),
      new ConditionTreeLeaf({ field: 'string', operator: Operator.In, value: ['value'] }),
      new ConditionTreeLeaf({
        field: 'array',
        operator: Operator.IncludesAll,
        value: ['value'],
      }),
      new ConditionTreeLeaf({ field: 'string', operator: Operator.LongerThan, value: 0 }),
      new ConditionTreeLeaf({ field: 'string', operator: Operator.ShorterThan, value: 999 }),
    ]);

    expect(allConditions.match({ string: 'value', array: ['value'] })).toBeTruthy();
  });

  test('match() should crash with unsupported operators', () => {
    const today = new ConditionTreeLeaf({ field: 'column', operator: Operator.Today });

    expect(() => today.match({})).toThrow("Unsupported operator: 'today'");
  });

  test('nest() should work', () => {
    expect(tree.nest('prefix')).toEqual({
      aggregator: Aggregator.And,
      conditions: [
        { field: 'prefix:column1', operator: Operator.Equal, value: true },
        { field: 'prefix:column2', operator: Operator.Equal, value: true },
        { condition: { field: 'prefix:column2', operator: Operator.Equal, value: false } },
      ],
    });
  });

  test('unnest() should work', () => {
    expect(tree.nest('prefix').unnest()).toEqual(tree);
  });

  test('unnest() should throw', () => {
    expect(() => tree.unnest()).toThrow('Cannot unnest condition tree.');
  });

  test('projection() should work', () => {
    expect(tree.projection).toEqual(['column1', 'column2']);
  });

  test('replaceFields() should work', () => {
    expect(tree.replaceFields(field => `${field}:suffix`)).toEqual({
      aggregator: Aggregator.And,
      conditions: [
        { field: 'column1:suffix', operator: Operator.Equal, value: true },
        { field: 'column2:suffix', operator: Operator.Equal, value: true },
        { condition: { field: 'column2:suffix', operator: Operator.Equal, value: false } },
      ],
    });
  });

  test('replaceLeafs() should work when returning leaf instance', () => {
    expect(tree.replaceLeafs(leaf => leaf.override({ value: !leaf.value }))).toEqual({
      aggregator: Aggregator.And,
      conditions: [
        { field: 'column1', operator: Operator.Equal, value: false },
        { field: 'column2', operator: Operator.Equal, value: false },
        { condition: { field: 'column2', operator: Operator.Equal, value: true } },
      ],
    });
  });

  test('replaceLeafs() should work when returning plain object', () => {
    expect(tree.replaceLeafs(leaf => ({ ...leaf, value: !leaf.value }))).toEqual({
      aggregator: Aggregator.And,
      conditions: [
        { field: 'column1', operator: Operator.Equal, value: false },
        { field: 'column2', operator: Operator.Equal, value: false },
        { condition: { field: 'column2', operator: Operator.Equal, value: true } },
      ],
    });
  });

  test('replaceLeafsAsync() should work when returning leaf instance', async () => {
    expect(
      await tree.replaceLeafsAsync(async leaf => leaf.override({ value: !leaf.value })),
    ).toEqual({
      aggregator: Aggregator.And,
      conditions: [
        { field: 'column1', operator: Operator.Equal, value: false },
        { field: 'column2', operator: Operator.Equal, value: false },
        { condition: { field: 'column2', operator: Operator.Equal, value: true } },
      ],
    });
  });

  test('replaceLeafsAsync() should work when returning plain object', async () => {
    expect(await tree.replaceLeafsAsync(async leaf => ({ ...leaf, value: !leaf.value }))).toEqual({
      aggregator: Aggregator.And,
      conditions: [
        { field: 'column1', operator: Operator.Equal, value: false },
        { field: 'column2', operator: Operator.Equal, value: false },
        { condition: { field: 'column2', operator: Operator.Equal, value: true } },
      ],
    });
  });

  test('someLeaf() should work', () => {
    expect(tree.someLeaf(leaf => leaf.value === true)).toBe(true);
    expect(tree.someLeaf(leaf => leaf.field === 'column1')).toBe(true);
    expect(tree.someLeaf(leaf => leaf.field.startsWith('something'))).toBe(false);
  });
});
