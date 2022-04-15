import SqlDataSource from '@forestadmin/datasource-sql';

export default async (): Promise<SqlDataSource> => {
  const dataSource = new SqlDataSource('mariadb://example:password@localhost:3808/example');
  await dataSource.build();

  return dataSource;
};
