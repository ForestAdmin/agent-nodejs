import RelaxedDataSource from '@forestadmin/datasource-customizer/dist/context/relaxed-wrappers/datasource';
import PublicationCollectionDataSourceDecorator from '@forestadmin/datasource-customizer/dist/decorators/publication-collection/datasource';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import SchemaDataSourceDecorator from './decorators/schema/data-source';
import TriggerSyncDataSourceDecorator from './decorators/sync/data-source';
import WriteDataSourceDecorator from './decorators/write/data-source';
import resolveOptions from './options';
import { createModels, createSequelize } from './sequelize';
import CacheTarget from './synchronization/cache-target';
import { CachedDataSourceOptions } from './types';

const systemTables = ['forest_pending_records', 'forest_schema', 'forest_sync_state'];

function createCachedDataSource(rawOptions: CachedDataSourceOptions): DataSourceFactory {
  return async (logger: Logger) => {
    // Init sequelize connection
    // This is done in two steps to allow schema discovery (we might not know the schema in advance)
    const connection = await createSequelize(logger, rawOptions.cacheInto);
    const options = await resolveOptions(rawOptions, connection);
    await createModels(connection, options);

    // Create the sequelize data source and provide it to the source
    // (to allow customers to use it when handling requests if they want to)
    const sequelizeDs = await createSequelizeDataSource(connection)(logger);
    const publicationDs = new PublicationCollectionDataSourceDecorator(sequelizeDs);
    publicationDs.keepCollectionsMatching(null, systemTables);

    options.source.requestCache = new RelaxedDataSource(publicationDs, null);

    // Start synchronization between our database and the source.
    // (or replay the dump/delta if they were already synchronized when guessing the schema)
    await options.source.start(new CacheTarget(connection, options));

    // Additional decorators
    const triggerSyncDataSource = new TriggerSyncDataSourceDecorator(publicationDs, options);
    const writeDataSource = new WriteDataSourceDecorator(triggerSyncDataSource, options);

    return new SchemaDataSourceDecorator(writeDataSource, options);
  };
}

export { ColumnType } from '@forestadmin/datasource-toolkit';
export * from './types';
export { createCachedDataSource };
