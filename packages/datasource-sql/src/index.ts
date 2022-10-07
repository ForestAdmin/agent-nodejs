import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import { Table } from './introspection/types';
import Introspector from './introspection/introspector';
import ModelBuilder from './orm-builder/model';
import RelationBuilder from './orm-builder/relations';

function createEmptySequelize(connectionUri: string, logger: Logger): Sequelize {
  if (!/.*:\/\//g.test(connectionUri))
    throw new Error(
      `Connection Uri "${connectionUri}" provided to SQL data source is not valid.` +
        ' Should be <dialect>://<connection>.',
    );

  const logging = (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));

  return new Sequelize(connectionUri, { logging });
}

export async function introspect(connectionUri: string, logger?: Logger): Promise<Table[]> {
  const sequelize = createEmptySequelize(connectionUri, logger);
  const tables = await Introspector.introspect(sequelize, logger);
  sequelize.close();

  return tables;
}

export async function buildSequelizeInstance(
  connectionUri: string,
  logger: Logger,
  introspection?: Table[],
): Promise<Sequelize> {
  const sequelize = createEmptySequelize(connectionUri, logger);
  const tables = introspection ?? (await Introspector.introspect(sequelize, logger));

  ModelBuilder.defineModels(sequelize, logger, tables);
  RelationBuilder.defineRelations(sequelize, logger, tables);

  return sequelize;
}

export function createSqlDataSource(
  connectionUri: string,
  options?: { introspection: Table[] },
): DataSourceFactory {
  return async (logger: Logger) => {
    const sequelize = await buildSequelizeInstance(connectionUri, logger, options?.introspection);

    return new SequelizeDataSource(sequelize, logger);
  };
}
