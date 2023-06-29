import PublicationCollectionDataSourceDecorator from '@forestadmin/datasource-customizer/dist/decorators/publication-collection/datasource';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import SyncDataSourceDecorator from './decorators/sync/data-source';
import WriteDataSourceDecorator from './decorators/write/data-source';
import createSequelize from './sequelize';
import { CachedDataSourceOptions } from './types';

function createCachedDataSource(options: CachedDataSourceOptions): DataSourceFactory {
  return async (logger: Logger) => {
    const schema = await (typeof options.schema === 'function' ? options.schema() : options.schema);
    const connection = await createSequelize(options, schema);
    const factory = createSequelizeDataSource(connection);

    const sequelizeDs = await factory(logger);
    const publicationDs = new PublicationCollectionDataSourceDecorator(sequelizeDs);
    publicationDs.keepCollectionsMatching(null, ['forest_sync_state']);

    const syncDataSource = new SyncDataSourceDecorator(publicationDs, connection, options);
    await syncDataSource.start();

    const writeDataSource = new WriteDataSourceDecorator(syncDataSource, options);

    return writeDataSource;
  };
}

export { ColumnType } from '@forestadmin/datasource-toolkit';
export * from './types';
export { createCachedDataSource };
