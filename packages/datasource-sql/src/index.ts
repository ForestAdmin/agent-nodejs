import type { Table } from './introspection/types';
import type { ConnectionOptions } from './types';
import type { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';

import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { Sequelize } from 'sequelize';

import Introspector from './introspection/introspector';
import ModelBuilder from './orm-builder/model';
import RelationBuilder from './orm-builder/relations';

function createEmptySequelize(uriOrOptions: ConnectionOptions, logger: Logger): Sequelize {
  if (typeof uriOrOptions === 'string' && !/.*:\/\//g.test(uriOrOptions))
    throw new Error(
      `Connection Uri "${uriOrOptions}" provided to SQL data source is not valid.` +
        ' Should be <dialect>://<connection>.',
    );

  const logging = (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));
  const getSchema = (uri: string): string => new URL(uri).searchParams.get('schema');
  let sequelize: Sequelize;

  if (typeof uriOrOptions === 'string') {
    sequelize = new Sequelize(uriOrOptions, { schema: getSchema(uriOrOptions), logging });
  } else if (uriOrOptions.uri) {
    const { uri, ...options } = uriOrOptions;
    sequelize = new Sequelize(uri, { ...options, schema: getSchema(uri), logging });
  } else {
    sequelize = new Sequelize({ ...uriOrOptions, logging });
  }

  return sequelize;
}

export async function introspect(
  uriOrOptions: ConnectionOptions,
  logger?: Logger,
): Promise<Table[]> {
  const sequelize = createEmptySequelize(uriOrOptions, logger);
  const tables = await Introspector.introspect(sequelize, logger);
  await sequelize.close();

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
  options?: { introspection?: Table[]; castUuidToString?: boolean },
): DataSourceFactory {
  return async (logger: Logger) => {
    const sequelize = await buildSequelizeInstance(uriOrOptions, logger, options?.introspection);

    return new SequelizeDataSource(sequelize, logger, {
      castUuidToString: options?.castUuidToString,
    });
  };
}

export type { ConnectionOptions, Table };
