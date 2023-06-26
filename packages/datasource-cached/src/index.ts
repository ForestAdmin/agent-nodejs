import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { DataSource, DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import FullLoadDataSourceDecorator from './decorators/full-load/data-source';
import IncrementalDataSourceDecorator from './decorators/incremental/data-source';
import WriteDataSourceDecorator from './decorators/write/data-source';
import createSequelize from './sequelize';
import { CachedDataSourceOptions } from './types';

function createCachedDataSource(options: CachedDataSourceOptions): DataSourceFactory {
  return async (logger: Logger) => {
    const schema = await (typeof options.schema === 'function' ? options.schema() : options.schema);
    const connection = await createSequelize(options, schema);
    const factory = createSequelizeDataSource(connection);

    let last: DataSource = await factory(logger);

    if (options.syncStrategy === 'incremental') {
      last = new IncrementalDataSourceDecorator(last, connection, options);
    } else if (options.syncStrategy === 'full-load') {
      last = new FullLoadDataSourceDecorator(last, connection, options);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new Error(`Unknown sync strategy: ${(options as any).syncStrategy}`);
    }

    last = new WriteDataSourceDecorator(last, options);

    return last;
  };
}

export { DataType, DataTypes } from 'sequelize';
export * from './types';
export { createCachedDataSource };
