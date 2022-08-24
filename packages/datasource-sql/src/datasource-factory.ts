import { DataSource } from '@forestadmin/datasource-toolkit';

import { Orm } from './utils/types';

export default class SqlDataSourceFactory {
  static async build(orm: Orm): Promise<DataSource> {
    const excludedTables = new Set<string>();
    const tableNames = await orm.getTableNames();

    const modelsToBuild = tableNames.map(async tableName => {
      try {
        await orm.defineModel(tableName);
      } catch (e) {
        excludedTables.add(tableName);
        orm.logger?.(
          'Warn',
          `Skipping table "${tableName}" and its relations because of error: ${e.message}`,
        );
      }
    });
    await Promise.all(modelsToBuild);

    const relationsToBuild = tableNames.map(async tableName => {
      if (await SqlDataSourceFactory.canDefineRelation(tableName, orm, excludedTables)) {
        await orm.defineRelation(tableName);
      }
    });
    await Promise.all(relationsToBuild);

    return orm.buildDataSource();
  }

  private static async canDefineRelation(tableName: string, orm: Orm, excludedTables) {
    const relatedTables = await orm.getRelatedTables(tableName);

    return !relatedTables.some(table => excludedTables.has(table));
  }
}
