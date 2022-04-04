import { Dialect } from 'sequelize/types';

import SqlDataSource from '@forestadmin/datasource-sql';

export default async (): Promise<SqlDataSource> => {
  const dialect: Dialect = process.env.SQL_DIALECT as Dialect;
  let dataSource: SqlDataSource;

  switch (dialect) {
    case 'mssql':
      dataSource = new SqlDataSource('mssql://sa:yourStrong(!)Password@localhost:1433/example');
      break;
    case 'mysql':
      dataSource = new SqlDataSource('mysql://example:password@localhost:3306/example');
      break;
    default:
      dataSource = new SqlDataSource('postgres://example:password@localhost:5442/example');
  }

  await dataSource.build();

  return dataSource;
};
