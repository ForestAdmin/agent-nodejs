import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import SequelizeOrm from './sequelize-orm';
import SqlDataSource from './datasource-factory';

// eslint-disable-next-line import/prefer-default-export
export function createSqlDataSource(connectionUri: string): DataSourceFactory {
  if (!/.*:\/\//g.test(connectionUri))
    throw new Error(
      `Connection Uri "${connectionUri}" provided to Sql data source is not valid.` +
        ' Should be <dialect>://<connection>.',
    );

  return async (logger: Logger) => {
    return SqlDataSource.build(new SequelizeOrm(connectionUri, logger));
  };
}
