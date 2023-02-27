import CallerParser from '../../../src/utils/query-parser/caller';
import tableViewCountQuery from '../../__queries__/table-view-count';

describe('CountFilterParser', () => {
  it('should parse tableViewCountQuery query correctly', () => {
    const filter = CallerParser.fromCtx(tableViewCountQuery);

    expect(filter).toEqual({
      email: 'romaing@forestadmin.com',
      exp: 1677238052,
      firstName: 'Romain',
      iat: 1677234452,
      id: 1,
      lastName: 'Gilliotte',
      permissionLevel: 'admin',
      renderingId: 2,
      tags: {},
      team: 'Operations',
      timezone: 'Europe/Paris',
    });
  });
});
