import SqlDataSource from '@forestadmin/datasource-sql';

export default async (): Promise<SqlDataSource> => {
  return new SqlDataSource('postgres://example:password@localhost:5442/example');
};
