import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import { CachedDataSourceOptions, LiveDataSourceOptions, LiveSchema } from './types';
import CachedDataSource from './cached/cached-datasource';
import CollectionAttributesConverter from './utils/attributes-converter';
import CollectionRelationsConverter from './utils/relation-converter';

export function createLiveDataSource(
  schema: LiveSchema,
  options?: LiveDataSourceOptions,
): DataSourceFactory {
  return async (logger: Logger) => {
    const logging = (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));
    const sequelize = new Sequelize('sqlite::memory:', { logging });

    // Set all columns, and then relations
    for (const [name, collectionSchema] of Object.entries(schema))
      sequelize.define(name, CollectionAttributesConverter.convert(collectionSchema));
    for (const [name, collectionSchema] of Object.entries(schema))
      CollectionRelationsConverter.convert(name, collectionSchema, sequelize);

    // Synchronize
    await sequelize.sync({ force: true });

    // Seed
    const dataSource = new SequelizeDataSource(sequelize, logger);
    if (options?.seeder) await options.seeder(dataSource);

    return dataSource;
  };
}

export function createCachedDataSource(
  schema: LiveSchema,
  options: CachedDataSourceOptions,
): DataSourceFactory {
  return async (logger: Logger) => {
    const factory = createLiveDataSource(schema);
    const cache = await factory(logger);

    return new CachedDataSource(logger, cache, options);
  };
}
