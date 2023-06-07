import type { Table } from './introspection/types';
import type { ConnectionOptions, SslMode } from './types';
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
  let sequelize: Sequelize;

  try {
    sequelize = await connect(uriOrOptions, logger);

    return await Introspector.introspect(sequelize, logger);
  } finally {
    await sequelize?.close();
  }
}

export function stringifyIntrospection(introspection: Table[]): string {
  return Introspector.stringify(introspection);
}

export function parseIntrospectionFromString(introspection: string): Table[] {
  return Introspector.parse(introspection);
}

export async function buildSequelizeInstance(
  uriOrOptions: ConnectionOptions,
  logger: Logger,
  introspection?: Table[],
): Promise<Sequelize> {
  let sequelize: Sequelize;

  try {
    sequelize = await connect(uriOrOptions, logger);
    const tables = introspection ?? (await Introspector.introspect(sequelize, logger));
    ModelBuilder.defineModels(sequelize, logger, tables);
    RelationBuilder.defineRelations(sequelize, logger, tables);
  } catch (error) {
    await sequelize?.close();
    throw error;
  }

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

export type { ConnectionOptions, Table, SslMode };
export { default as preprocessOptions } from './connection/preprocess';
export * from './connection/errors';
