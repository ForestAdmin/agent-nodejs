import { Collection, DataSource } from '../interfaces/collection';
import BaseDataSource from '../base-datasource';

type CollectionDecoratorConstructor<CollectionDecorator> = {
  new (c: Collection, d: DataSource): CollectionDecorator;
};

export default class DataSourceDecorator<
  CollectionDecorator extends Collection,
> extends BaseDataSource<CollectionDecorator> {
  constructor(
    childDataSource: DataSource,
    CollectionDecoratorConstructor: CollectionDecoratorConstructor<CollectionDecorator>,
  ) {
    super();

    for (const collection of childDataSource.collections) {
      this.addCollection(new CollectionDecoratorConstructor(collection, this));
    }
  }
}
