import { DataSource } from '@forestadmin/datasource-toolkit';

import { Model, Orm } from './utils/types';

export default class SqlDataSource {
  private readonly orm: Orm;

  constructor(orm: Orm) {
    this.orm = orm;
  }

  async build(): Promise<DataSource> {
    await this.orm.defineModels();
    await this.orm.defineRelations();
    this.orm.definedCollections();

    return this.orm.getDataSource();
  }
}
