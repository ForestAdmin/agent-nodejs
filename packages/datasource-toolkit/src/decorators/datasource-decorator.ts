import { Collection, DataSource } from '../interfaces/collection';
import BaseDataSource from '../base-datasource';

type CollectionDecoratorConstructor<CollectionDecorator> = {
  new (c: Collection, d: DataSource): CollectionDecorator;
};

export default class DataSourceDecorator<
  CollectionDecorator extends Collection,
> extends BaseDataSource<CollectionDecorator> {
  private readonly CollectionDecoratorCtor: CollectionDecoratorConstructor<CollectionDecorator>;
  private readonly childDataSource: DataSource;
  private addCollectionToChildDataSource: (collection: Collection) => void;

  addCollectionObserver(collection: Collection) {
    this.addCollectionToChildDataSource(collection);
    this.addCollection(new this.CollectionDecoratorCtor(collection, this));
  }

  constructor(
    childDataSource: DataSource,
    CollectionDecoratorCtor: CollectionDecoratorConstructor<CollectionDecorator>,
  ) {
    super();

    this.addCollectionToChildDataSource = childDataSource.addCollection.bind(childDataSource);
    Reflect.defineProperty(childDataSource, 'addCollection', {
      value: this.addCollectionObserver.bind(this),
    });

    this.childDataSource = childDataSource;
    this.CollectionDecoratorCtor = CollectionDecoratorCtor;

    this.childDataSource.collections.forEach(collection =>
      this.addCollection(new this.CollectionDecoratorCtor(collection, this)),
    );
  }
}
