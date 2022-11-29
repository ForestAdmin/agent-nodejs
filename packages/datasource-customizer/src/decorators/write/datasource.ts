import { Caller, Collection, DataSource, DataSourceSchema } from '@forestadmin/datasource-toolkit';

import DataSourceDecorator from '../datasource-decorator';
import RelationWriterCollectionDecorator from './collection-relation-handler';
import WriteReplacerCollectionDecorator from './collection-write-replace';

export default class WriteDecorator implements DataSource {
  private readonly dataSource: DataSource;

  constructor(childDataSource: DataSource) {
    const decorator = new DataSourceDecorator(childDataSource, WriteReplacerCollectionDecorator);
    this.dataSource = new DataSourceDecorator(decorator, RelationWriterCollectionDecorator);
  }

  get collections(): Collection[] {
    return this.dataSource.collections;
  }

  get schema(): DataSourceSchema {
    return this.dataSource.schema;
  }

  getCollection(name: string): Collection {
    return this.dataSource.getCollection(name);
  }

  addCollection(collection: Collection): void {
    return this.dataSource.addCollection(collection);
  }

  renderChart(caller: Caller, name: string): Promise<unknown> {
    return this.dataSource.renderChart(caller, name);
  }
}
