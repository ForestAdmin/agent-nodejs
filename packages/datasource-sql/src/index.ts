import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import { DatabaseConnectionOptions as ConnectionOptions } from './types';
import { Table } from './introspection/types';
import Introspector from './introspection/introspector';
import ModelBuilder from './orm-builder/model';
import RelationBuilder from './orm-builder/relations';

function createEmptySequelize(uriOrOptions: ConnectionOptions, logger: Logger): Sequelize {
  const logging = (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));

  if (typeof uriOrOptions === 'string' && !/.*:\/\//g.test(uriOrOptions))
    throw new Error(
      `Connection Uri "${uriOrOptions}" provided to SQL data source is not valid.` +
        ' Should be <dialect>://<connection>.',
    );

  return typeof uriOrOptions === 'string'
    ? new Sequelize(uriOrOptions, { logging })
    : new Sequelize({ ...uriOrOptions, logging });
}

export async function introspect(
  uriOrOptions: ConnectionOptions,
  logger?: Logger,
): Promise<Table[]> {
  const sequelize = createEmptySequelize(uriOrOptions, logger);
  const tables = await Introspector.introspect(sequelize, logger);
  sequelize.close();

  return tables;
}

export async function buildSequelizeInstance(
  uriOrOptions: ConnectionOptions,
  logger: Logger,
  introspection?: Table[],
): Promise<Sequelize> {
  const sequelize = createEmptySequelize(uriOrOptions, logger);
  const tables = introspection ?? (await Introspector.introspect(sequelize, logger));

  ModelBuilder.defineModels(sequelize, logger, tables);
  RelationBuilder.defineRelations(sequelize, logger, tables);

  return sequelize;
}

export function createSqlDataSource(
  uriOrOptions: ConnectionOptions,
  options?: { introspection: Table[] },
): DataSourceFactory {
  return async (logger: Logger) => {
    const sequelize = await buildSequelizeInstance(uriOrOptions, logger, options?.introspection);

    return new SequelizeDataSource(sequelize, logger);
  };
}
