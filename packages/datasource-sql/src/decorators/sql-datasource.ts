import { SequelizeDataSource } from '@forestadmin/datasource-sequelize';
import { Collection, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import ViewDecorator from './view-decorator';
import { Table } from '../introspection/types';

export default class SqlDatasource extends DataSourceDecorator<Collection> {
  private readonly viewNames: Set<string> = new Set();

  constructor(childDataSource: SequelizeDataSource, views: Table[]) {
    super(childDataSource, ViewDecorator);

    this.viewNames = new Set(views?.map(({ name }) => name));
  }

  override getCollection(name: string): Collection {
    const collection = this.childDataSource.getCollection(name);

    if (!this.viewNames.has(name)) return collection;

    return super.getCollection(name);
  }

  public async close() {
    await (this.childDataSource as SequelizeDataSource).close();
  }
}
