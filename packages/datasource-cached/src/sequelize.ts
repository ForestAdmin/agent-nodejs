import { buildSequelizeInstance } from '@forestadmin/datasource-sql';
import { DataTypes } from 'sequelize';

import { CachedCollectionSchema, CachedDataSourceOptions } from './types';

export default async function createSequelize(
  options: CachedDataSourceOptions,
  schema: CachedCollectionSchema[],
) {
  const sequelize = await buildSequelizeInstance(
    options.cacheInto ?? 'sqlite::memory:',
    () => {},
    [],
  );

  sequelize.define(`forest_sync_state`, {
    id: { type: DataTypes.STRING, primaryKey: true },
    state: DataTypes.STRING,
  });

  for (const model of schema) {
    const columns = Object.entries(model.columns).map(([name, column]) => [
      name,
      { type: column.columnType, primaryKey: column.isPrimaryKey },
    ]);

    sequelize.define(`${options.namespace}_${model.name}`, Object.fromEntries(columns), {
      timestamps: false,
    });
  }

  await sequelize.sync();

  return sequelize;
}
