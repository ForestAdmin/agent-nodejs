import { DataSource } from '@forestadmin/datasource-toolkit';

import { Builder } from './utils/types';

export default class SqlDataSourceFactory {
  static async build(builder: Builder): Promise<DataSource> {
    const excludedTables = new Set<string>();
    const tableNames = await builder.getTableNames();

    const modelsToBuild = tableNames.map(async tableName => {
      try {
        await builder.defineModel(tableName);
      } catch (e) {
        excludedTables.add(tableName);
        builder.logger?.(
          'Warn',
          `Skipping table "${tableName}" and its relations because of error: ${e.message}`,
        );
      }
    });
    await Promise.all(modelsToBuild);

    const relationsToBuild = tableNames.map(async tableName => {
      if (await SqlDataSourceFactory.canDefineRelation(tableName, builder, excludedTables)) {
        await builder.defineRelation(tableName);
      }
    });
    await Promise.all(relationsToBuild);

    return builder.buildDataSource();
  }

  private static async canDefineRelation(tableName: string, builder: Builder, excludedTables) {
    if (excludedTables.has(tableName)) {
      return false;
    }

    const relatedTables = await builder.getRelatedTables(tableName);

    return !relatedTables.some(table => excludedTables.has(table));
  }
}
