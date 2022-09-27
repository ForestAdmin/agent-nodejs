import {
  BaseDataSource,
  Caller,
  Chart,
  Collection,
  DataSource,
  DataSourceSchema,
} from '@forestadmin/datasource-toolkit';

type CollectionDecoratorConstructor<CollectionDecorator extends Collection> = {
  new (c: Collection, d: DataSource): CollectionDecorator;
};

export default class DataSourceDecorator<
  CollectionDecorator extends Collection = Collection,
> extends BaseDataSource<CollectionDecorator> {
  protected readonly childDataSource: DataSource;
  private readonly CollectionDecoratorCtor: CollectionDecoratorConstructor<CollectionDecorator>;
  private readonly addCollectionToChildDataSource: (collection: Collection) => void;

  override get schema(): DataSourceSchema {
    return this.childDataSource.schema;
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

  override renderChart(caller: Caller, name: string): Promise<Chart> {
    return this.childDataSource.renderChart(caller, name);
  }

  private addCollectionObserver(collection: Collection) {
    this.addCollectionToChildDataSource(collection);
    this.addCollection(new this.CollectionDecoratorCtor(collection, this));
  }
}
