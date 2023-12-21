import { Collection, DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import ViewDecorator from './view-decorator';
import { Table } from '../introspection/types';

export default class SqlDatasource extends DataSourceDecorator<Collection> {
  private readonly viewNames: Set<string> = new Set();

  constructor(childDataSource: DataSource, views: Table[]) {
    super(childDataSource, ViewDecorator);

    this.viewNames = new Set(views?.map(({ name }) => name));
  }

  override getCollection(name: string): Collection {
    const collection = this.childDataSource.getCollection(name);

    if (!this.viewNames.has(name)) return collection;

    return super.getCollection(name);
  }
}
