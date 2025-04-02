import type { ReplicaDataSourceOptions } from './types';
import type { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import PublicationCollectionDataSourceDecorator from '@forestadmin/datasource-customizer/dist/decorators/publication/datasource';
import { createSequelizeDataSource } from '@forestadmin/datasource-sequelize';

import CacheDataSourceInterface from './cache-interface/datasource';
import SchemaDataSourceDecorator from './decorators/schema/data-source';
import TriggerSyncDataSourceDecorator from './decorators/sync/data-source';
import WriteDataSourceDecorator from './decorators/write/data-source';
import resolveOptions from './options';
import { createModels, createSequelize } from './sequelize';
import CacheTarget from './synchronization/cache-target';

function createReplicaDataSource(rawOptions: ReplicaDataSourceOptions): DataSourceFactory {
  // Default options
  rawOptions.cacheInto ??= 'sqlite::memory:';
  rawOptions.cacheNamespace ??= 'forest';

  return async (logger: Logger) => {
    // Init sequelize connection
    // This is done in two steps to allow schema discovery (we might not know the schema in advance)
    const connection = await createSequelize(logger, rawOptions);
    const options = await resolveOptions(rawOptions, logger, connection);
    await createModels(connection, options);

    // Create the sequelize data source and provide it to the source
    // (to allow customers to use it when handling requests if they want to)
    const sequelizeDs = await createSequelizeDataSource(connection)(logger, async () => {});
    const publicationDs = new PublicationCollectionDataSourceDecorator(sequelizeDs);
    publicationDs.keepCollectionsMatching(null, [
      `${options.cacheNamespace}_pending_operations`,
      `${options.cacheNamespace}_metadata`,
    ]);

    options.source.requestCache = new CacheDataSourceInterface(publicationDs);

    // Additional decorators
    const triggerSyncDecorator = new TriggerSyncDataSourceDecorator(publicationDs, options);
    const writeDecorator = new WriteDataSourceDecorator(triggerSyncDecorator, options);
    const schemaDecorator = new SchemaDataSourceDecorator(writeDecorator, options);

    // Start synchronization between our database and the source.
    // (or replay the dump/delta if they were already synchronized when guessing the schema)
    await options.source.start(new CacheTarget(connection, options, logger));

    return schemaDecorator;
  };
}

export * from './types';
export { createReplicaDataSource };
