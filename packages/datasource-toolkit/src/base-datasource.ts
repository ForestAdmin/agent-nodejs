import { Collection, DataSource } from './interfaces/collection';
import { Logger } from './logger';

export default class BaseDataSource<T extends Collection = Collection> implements DataSource {
  protected _collections: { [collectionName: string]: T } = {};
  protected logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public get collections(): T[] {
    return Object.values(this._collections);
  }

  getCollection(name: string): T {
    const collection = this._collections[name];

    if (collection === undefined) throw new Error(`Collection "${name}" not found.`);

    return collection;
  }

  public addCollection(collection: T): void {
    if (this._collections[collection.name] !== undefined)
      throw new Error(`Collection "${collection.name}" already defined in datasource`);

    this._collections[collection.name] = collection;
  }
}

export type DataSourceFactory = (logger: Logger) => Promise<DataSource>;
