import ConditionTreeLeaf, { Operator } from '../../dist/interfaces/query/condition-tree/leaf';
import PaginatedFilter from '../../dist/interfaces/query/filter/paginated';
import Filter from '../../dist/interfaces/query/filter/unpaginated';
import Page from '../../dist/interfaces/query/page';
import Sort from '../../dist/interfaces/query/sort';

describe('Filter', () => {
  const leaf = new ConditionTreeLeaf({
    field: 'column',
    operator: Operator.GreaterThan,
    value: 0,
  });

  describe('Paginated', () => {
    const paginatedFilter = new PaginatedFilter({
      conditionTree: leaf,
      page: new Page(),
      sort: new Sort({ field: 'column', ascending: true }),
    });

    test('override should work', () => {
      const newFilter = paginatedFilter.override({
        conditionTree: new ConditionTreeLeaf({
          field: 'column',
          operator: Operator.LessThan,
          value: 0,
        }),
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
        conditionTree: new ConditionTreeLeaf({
          field: 'column',
          operator: Operator.LessThan,
          value: 0,
        }),
      });

      expect(newFilter).toEqual({
        conditionTree: { field: 'column', operator: 'less_than', value: 0 },
      });
    });
  });
});
