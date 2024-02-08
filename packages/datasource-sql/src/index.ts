import type { Introspection, Table } from './introspection/types';
import type { PlainConnectionOptions, PlainConnectionOptionsOrUri, SslMode } from './types';
import type { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { Sequelize } from 'sequelize';

import connect from './connection';
import ConnectionOptions from './connection/connection-options';
import Introspector, { INTROSPECTION_FORMAT_VERSION } from './introspection/introspector';
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
  introspection?: Table[] | Introspection,
): Promise<Sequelize> {
  const options = new ConnectionOptions(uriOrOptions, logger);
  let sequelize: Sequelize;

  try {
    sequelize = await connect(options);
    const { tables } =
      Introspector.getIntrospectionInLatestFormat(introspection) ??
      (await Introspector.introspect(sequelize, logger));
    ModelBuilder.defineModels(sequelize, logger, tables);
    RelationBuilder.defineRelations(sequelize, logger, tables);
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
    const introspection: Introspection = Introspector.getIntrospectionInLatestFormat(
      options?.introspection,
    );

    if (introspection && introspection.version > INTROSPECTION_FORMAT_VERSION) {
      /* This can occur either:
        - cloud-toolkit does not have the same version of datasource-sql 
          as cloud-agent-manager & forestadmin-server (We need to fix)
        - on CLOUD version, datasource-sql should be updated in the local repository
          of the client. He should be prompted to update cloud-toolkit.
        - on SELF-HOSTED, client agent has the newer version of datasource-sql, but server still has
          the old version. Client should downgrade datasource-sql.
      */
      throw new Error(
        'This version of introspection is newer than this package version. ' +
          'Please update @forestadmin/datasource-sql',
      );
    }

    const sequelize = await buildSequelizeInstance(uriOrOptions, logger, introspection);

    return new SequelizeDataSource(sequelize, logger);
  };
}

/** Preprocess the connection options so that they can be cached for faster connections */
export async function preprocessOptions(
  uriOrOptions: PlainConnectionOptionsOrUri,
): Promise<PlainConnectionOptions> {
  return new ConnectionOptions(uriOrOptions).buildPreprocessedOptions();
}

export * from './connection/errors';
export type { PlainConnectionOptionsOrUri as ConnectionOptions, Table, SslMode, Introspection };
