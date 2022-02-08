import ConditionTreeLeaf, { Operator } from '../../src/interfaces/query/condition-tree/leaf';
import PaginatedFilter from '../../src/interfaces/query/filter/paginated';
import Filter from '../../src/interfaces/query/filter/unpaginated';
import Page from '../../src/interfaces/query/page';
import Sort from '../../src/interfaces/query/sort';

describe('Filter', () => {
  const leaf = new ConditionTreeLeaf('column', Operator.GreaterThan, 0);

  describe('Paginated', () => {
    const paginatedFilter = new PaginatedFilter({
      conditionTree: leaf,
      page: new Page(),
      sort: new Sort({ field: 'column', ascending: true }),
    });

    test('override should work', () => {
      const newFilter = paginatedFilter.override({
        conditionTree: new ConditionTreeLeaf('column', Operator.LessThan, 0),
        page: new Page(0, 10),
        sort: new Sort({ field: 'column2', ascending: true }),
      });

      expect(newFilter).toEqual({
        conditionTree: { field: 'column', operator: 'less_than', value: 0 },
        page: { limit: 10, skip: 0 },
        sort: [{ ascending: true, field: 'column2' }],
      });
    });
  });

  describe('Unpaginated', () => {
    const filter = new Filter({
      conditionTree: leaf,
    });

    test('override should work', () => {
      const newFilter = filter.override({
        conditionTree: new ConditionTreeLeaf('column', Operator.LessThan, 0),
      });

      expect(newFilter).toEqual({
        conditionTree: { field: 'column', operator: 'less_than', value: 0 },
      });
    });
  });
});
