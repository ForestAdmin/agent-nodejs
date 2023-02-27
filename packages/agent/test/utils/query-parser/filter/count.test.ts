import CountFilterParser from '../../../../src/utils/query-parser/filter/count';
import collection from '../../../__queries__/_datasource';
import tableViewCountQuery from '../../../__queries__/table-view-count';

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
