import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';
import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';

import Introspector from './introspection/introspector';
import ModelBuilder from './orm-builder/model';
import RelationBuilder from './orm-builder/relations';

export async function buildSequelizeInstance(
  connectionUri: string,
  logger: Logger,
): Promise<Sequelize> {
  if (!/.*:\/\//g.test(connectionUri))
    throw new Error(
      `Connection Uri "${connectionUri}" provided to SQL data source is not valid.` +
        ' Should be <dialect>://<connection>.',
    );

  const logging = (sql: string) => logger?.('Debug', sql.substring(sql.indexOf(':') + 2));
  const sequelize = new Sequelize(connectionUri, { logging });

  const tables = await Introspector.instrospect(sequelize, logger);
  ModelBuilder.defineModels(sequelize, logger, tables);
  RelationBuilder.defineRelations(sequelize, logger, tables);

  return sequelize;
}

export function createSqlDataSource(connectionUri: string): DataSourceFactory {
  return async (logger: Logger) => {
    const sequelize = await buildSequelizeInstance(connectionUri, logger);

    return new SequelizeDataSource(sequelize, logger);
  };
}
