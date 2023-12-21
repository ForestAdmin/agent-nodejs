import type { Introspection, Table } from './introspection/types';
import type { PlainConnectionOptions, PlainConnectionOptionsOrUri, SslMode } from './types';
import type { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { Sequelize } from 'sequelize';

import connect from './connection';
import ConnectionOptions from './connection/connection-options';
import SqlDatasource from './decorators/sql-datasource';
import Introspector from './introspection/introspector';
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

export async function buildSequelizeInstance(
  uriOrOptions: PlainConnectionOptionsOrUri,
  logger: Logger,
  introspection?: Introspection,
): Promise<Sequelize> {
  const options = new ConnectionOptions(uriOrOptions, logger);
  let sequelize: Sequelize;

  try {
    sequelize = await connect(options);
    const computedIntrospection =
      introspection ?? (await Introspector.introspect(sequelize, logger));
    ModelBuilder.defineModels(sequelize, logger, computedIntrospection);
    RelationBuilder.defineRelations(sequelize, logger, computedIntrospection);
  } catch (error) {
    await sequelize?.close();
    throw error;
  }

  return sequelize;
}

export function createSqlDataSource(
  uriOrOptions: PlainConnectionOptionsOrUri,
  options?: { introspection: Table[] | Introspection },
): DataSourceFactory {
  return async (logger: Logger) => {
    let sequelize: Sequelize;
    let introspection: Introspection = Array.isArray(options?.introspection)
      ? { tables: options.introspection }
      : options?.introspection;

    try {
      const connectionOptions = new ConnectionOptions(uriOrOptions, logger);
      sequelize = await connect(connectionOptions);
      introspection = introspection ?? (await Introspector.introspect(sequelize, logger));
      ModelBuilder.defineModels(sequelize, logger, introspection);
      RelationBuilder.defineRelations(sequelize, logger, introspection);
    } catch (error) {
      await sequelize?.close();
      throw error;
    }

    return new SqlDatasource(new SequelizeDataSource(sequelize, logger), introspection?.views);
  };
}

/** Preprocess the connection options so that they can be cached for faster connections */
export async function preprocessOptions(
  uriOrOptions: PlainConnectionOptionsOrUri,
): Promise<PlainConnectionOptions> {
  return new ConnectionOptions(uriOrOptions).buildPreprocessedOptions();
}

export * from './connection/errors';
export type { PlainConnectionOptionsOrUri as ConnectionOptions, Table, SslMode };
