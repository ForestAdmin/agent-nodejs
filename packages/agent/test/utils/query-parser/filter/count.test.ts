import CountFilterParser from '../../../../src/utils/query-parser/filter/count';
import collection from '../_queries/_collection';
import tableViewCountQuery from '../_queries/table-view-count';

describe('CountFilterParser', () => {
  it('should parse tableViewCountQuery query correctly', () => {
    const filter = CountFilterParser.fromCtx(collection, tableViewCountQuery);

    expect(filter).toEqual({
      conditionTree: null,
      search: null,
      searchExtended: false,
      segment: null,
    });
  });
});
