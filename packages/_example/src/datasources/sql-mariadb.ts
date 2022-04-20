import { DataSourceFactory } from '@forestadmin/datasource-toolkit';
import makeSqlDataSource from '@forestadmin/datasource-sql';

export default (): Promise<DataSourceFactory> => {
  return makeSqlDataSource('mariadb://example:password@localhost:3808/example');
};
