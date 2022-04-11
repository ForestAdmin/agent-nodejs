import SqlDataSource from '../src/datasource';

describe('datasource', () => {
  it('should create a sql datasource', () => {
    const sqlDatasource = new SqlDataSource('postgres://');
    expect(sqlDatasource).toBeDefined();
  });
});
