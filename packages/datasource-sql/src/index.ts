import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import { Table } from './introspection/types';
import Introspector from './introspection/introspector';
import ModelBuilder from './orm-builder/model';
import RelationBuilder from './orm-builder/relations';

export async function introspect(sequelize: Sequelize, logger?: Logger): Promise<Table[]> {
  return Introspector.introspect(sequelize, logger);
}

export async function buildSequelizeInstance(
  connectionUri: string,
  logger: Logger,
  introspection?: Table[],
): Promise<Sequelize> {
  if (!/.*:\/\//g.test(connectionUri))
    throw new Error(
      `Connection Uri "${connectionUri}" provided to SQL data source is not valid.` +
        ' Should be <dialect>://<connection>.',
    );

  const logging = (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));
  const sequelize = new Sequelize(connectionUri, { logging });

  const tables = introspection ?? (await Introspector.introspect(sequelize, logger));
  ModelBuilder.defineModels(sequelize, logger, tables);
  RelationBuilder.defineRelations(sequelize, logger, tables);

  return sequelize;
}

export function createSqlDataSource(
  connectionUri: string,
  options?: { instrospection: Table[] },
): DataSourceFactory {
  return async (logger: Logger) => {
    const sequelize = await buildSequelizeInstance(connectionUri, logger, options?.instrospection);

    return new SequelizeDataSource(sequelize, logger);
  };
}
