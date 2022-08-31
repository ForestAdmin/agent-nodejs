import { DataSource } from '@forestadmin/datasource-toolkit';

import { Builder } from './utils/types';

export default class SqlDataSourceFactory {
  static async build(builder: Builder): Promise<DataSource> {
    const tableNames = await builder.getTableNames();

    const modelsToBuild = tableNames.map(async tableName => {
      await builder.defineModel(tableName);
    });
    await Promise.all(modelsToBuild);

    const relationsToBuild = tableNames.map(async tableName => {
      await builder.defineRelation(tableName);
    });
    await Promise.all(relationsToBuild);

    return builder.buildDataSource();
  }
}
