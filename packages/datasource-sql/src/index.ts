import type { Table } from './introspection/types';
import type { ConnectionOptions } from './types';
import type { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { Sequelize } from 'sequelize';

import connect from './connection';
import Introspector from './introspection/introspector';
import ModelBuilder from './orm-builder/model';
import RelationBuilder from './orm-builder/relations';

export async function introspect(
  uriOrOptions: ConnectionOptions,
  logger?: Logger,
): Promise<Table[]> {
  const sequelize = await connect(uriOrOptions, logger);
  const tables = await Introspector.introspect(sequelize, logger);
  await sequelize.close();

  return tables;
}

export async function buildSequelizeInstance(
  uriOrOptions: ConnectionOptions,
  logger: Logger,
  introspection?: Table[],
): Promise<Sequelize> {
  const sequelize = await connect(uriOrOptions, logger);
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

export type { ConnectionOptions, Table };
export { default as preprocessOptions } from './connection/preprocess';
