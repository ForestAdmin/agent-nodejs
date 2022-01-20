import BaseDataSource from '../base-datasource';
import { Collection, DataSource } from '../interfaces/collection';

type CollectionDecoratorCtor<CollectionDecorator> = {
  new (c: Collection, d: DataSource): CollectionDecorator;
};

export default class DataSourceDecorator<
  CollectionDecorator extends Collection,
> extends BaseDataSource<CollectionDecorator> {
  constructor(
    childBackend: DataSource,
    CollectionDecoratorCtor: CollectionDecoratorCtor<CollectionDecorator>,
  ) {
    super();

    for (const collection of childBackend.collections) {
      this.addCollection(new CollectionDecoratorCtor(collection, this));
    }
  }
}
