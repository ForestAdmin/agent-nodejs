import { Collection, DataSource } from './interfaces/collection';

export default class BaseDataSource<T extends Collection> implements DataSource {
  private _collections: { [collectionName: string]: T } = {};

  public get collections(): T[] {
    return Object.values(this._collections);
  }

  getCollection(name: string): T {
    const collection = this._collections[name];

    if (collection === undefined) throw new Error(`Collection "${name}" not found.`);

    return collection;
  }

  public reset() {
    this._collections = {};
  }

  public addCollection(collection: T): void {
    if (this._collections[collection.name] !== undefined)
      throw new Error(`Collection "${collection.name}" already defined in datasource`);

    this._collections[collection.name] = collection;
  }
}
