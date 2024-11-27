import type {
  PlainConnectionOptions,
  PlainConnectionOptionsOrUri,
  SqlDatasourceOptions,
  SslMode,
} from './types';
import type { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { Sequelize } from 'sequelize';

import connect from './connection';
import ConnectionOptions from './connection/connection-options';
import SequelizeFactory from './connection/sequelize-factory';
import SqlDatasource from './decorators/sql-datasource';
import Introspector from './introspection/introspector';
import listCollectionsFromIntrospection from './introspection/list-collections-from-introspection';
import {
  Introspection,
  LatestIntrospection,
  SupportedIntrospection,
  Table,
} from './introspection/types';
import ModelBuilder from './orm-builder/model';
import RelationBuilder from './orm-builder/relations';

export async function introspect(
  uriOrOptions: PlainConnectionOptionsOrUri,
  logger?: Logger,
): Promise<Introspection> {
  const options = new ConnectionOptions(uriOrOptions, logger);
  let sequelize: Sequelize;

  try {
    sequelize = await connect(options);

    return await Introspector.introspect(sequelize, logger);
  } finally {
    await sequelize?.close();
  }
}

async function buildModelsAndRelations(
  sequelize: Sequelize,
  logger: Logger,
  introspection: SupportedIntrospection,
  displaySoftDeleted?: SqlDatasourceOptions['displaySoftDeleted'],
): Promise<LatestIntrospection> {
  try {
    const latestIntrospection = await Introspector.migrateOrIntrospect(
      sequelize,
      logger,
      introspection,
    );
    ModelBuilder.defineModels(sequelize, logger, latestIntrospection, displaySoftDeleted);
    RelationBuilder.defineRelations(sequelize, logger, latestIntrospection);

    return latestIntrospection;
  } catch (error) {
    await sequelize?.close();
    throw error;
  }
}

export async function buildDisconnectedSequelizeInstance(
  introspection: SupportedIntrospection,
  logger: Logger,
): Promise<Sequelize> {
  const options = new ConnectionOptions(
    { dialect: 'sqlite', sslMode: 'disabled', dialectModule: {} },
    logger,
  );
  const sequelize = SequelizeFactory.build(await options.buildSequelizeCtorOptions());
  await buildModelsAndRelations(sequelize, logger, introspection);

  return sequelize;
}

export async function buildSequelizeInstance(
  uriOrOptions: PlainConnectionOptionsOrUri,
  logger: Logger,
  introspection?: SupportedIntrospection,
): Promise<Sequelize> {
  const options = new ConnectionOptions(uriOrOptions, logger);
  const sequelize = await connect(options);
  await buildModelsAndRelations(sequelize, logger, introspection);

  return sequelize;
}

export function createSqlDataSource(
  uriOrOptions: PlainConnectionOptionsOrUri,
  options?: SqlDatasourceOptions,
): DataSourceFactory {
  return async (logger: Logger) => {
    const sequelize = await connect(new ConnectionOptions(uriOrOptions, logger));
    const latestIntrospection = await buildModelsAndRelations(
      sequelize,
      logger,
      options?.introspection,
      options?.displaySoftDeleted,
    );

    return new SqlDatasource(
      new SequelizeDataSource(sequelize, logger, {
        liveQueryConnections: options?.liveQueryConnections,
      }),
      latestIntrospection.views,
    );
  };
}

/** Preprocess the connection options so that they can be cached for faster connections */
export async function preprocessOptions(
  uriOrOptions: PlainConnectionOptionsOrUri,
): Promise<PlainConnectionOptions> {
  return new ConnectionOptions(uriOrOptions).buildPreprocessedOptions();
}

export * from './connection/errors';
export type {
  PlainConnectionOptionsOrUri as ConnectionOptions,
  Table,
  SslMode,
  Introspection,
  SupportedIntrospection,
};
export { listCollectionsFromIntrospection };
