import PublicationCollectionDataSourceDecorator from '@forestadmin/datasource-customizer/dist/decorators/publication-collection/datasource';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import SchemaDataSourceDecorator from './decorators/schema/data-source';
import SyncDataSourceDecorator from './decorators/sync/data-source';
import WriteDataSourceDecorator from './decorators/write/data-source';
import resolveOptions from './options';
import { createModels, createSequelize } from './sequelize';
import { CachedDataSourceOptions } from './types';

function createCachedDataSource(rawOptions: CachedDataSourceOptions): DataSourceFactory {
  return async (logger: Logger) => {
    const connection = await createSequelize(logger, rawOptions.cacheInto);
    const options = await resolveOptions(rawOptions, connection);

    await createModels(connection, options);
    const factory = createSequelizeDataSource(connection);

    const sequelizeDs = await factory(logger);
    const publicationDs = new PublicationCollectionDataSourceDecorator(sequelizeDs);
    publicationDs.keepCollectionsMatching(null, [
      'forest_pending_records',
      'forest_schema',
      'forest_sync_state',
    ]);

    const syncDataSource = new SyncDataSourceDecorator(publicationDs, connection, options);
    await syncDataSource.start();

    const writeDataSource = new WriteDataSourceDecorator(syncDataSource, options);
    const schemaDataSource = new SchemaDataSourceDecorator(writeDataSource, options);

    return schemaDataSource;
  };
}

export { ColumnType } from '@forestadmin/datasource-toolkit';
export * from './types';
export { createCachedDataSource };
