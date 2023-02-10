import ConditionTreeLeaf from '../../src/interfaces/query/condition-tree/nodes/leaf';
import Filter from '../../src/interfaces/query/filter';
import Page from '../../src/interfaces/query/page';
import Sort from '../../src/interfaces/query/sort';

describe('Filter', () => {
  const leaf = new ConditionTreeLeaf('column', 'GreaterThan', 0);
  const filter = new Filter({
    conditionTree: leaf,
    page: new Page(),
    sort: new Sort({ field: 'column', ascending: true }),
  });

  test('override should work', () => {
    const newFilter = filter.override({
      conditionTree: new ConditionTreeLeaf('column', 'LessThan', 0),
      page: new Page(0, 10),
      sort: new Sort({ field: 'column2', ascending: true }),
    });

    expect(newFilter).toEqual({
      conditionTree: { field: 'column', operator: 'LessThan', value: 0 },
      page: { limit: 10, skip: 0 },
      sort: [{ ascending: true, field: 'column2' }],
    });
  });

  test('nest should work', () => {
    const nestedFilter = filter.nest('prefix');

    expect(filter.isNestable).toBeTruthy();
    expect(nestedFilter).toEqual({
      conditionTree: { field: 'prefix:column', operator: 'GreaterThan', value: 0 },
      page: { limit: null, skip: 0 },
      sort: [{ ascending: true, field: 'prefix:column' }],
    });
  });

  test('nest should crash with a segment', () => {
    const segmentFilter = new Filter({ segment: 'someSegment' });

    expect(segmentFilter.isNestable).toBeFalsy();
    expect(() => segmentFilter.nest('prefix')).toThrow();
  });
});
