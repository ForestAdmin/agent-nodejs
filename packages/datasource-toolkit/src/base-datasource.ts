import { Collection, DataSource } from './interfaces/collection';

export default abstract class BaseDataSource<T extends Collection> implements DataSource {
  private _collections: { [collectionName: string]: T } = {};

  public get collections(): T[] {
    // eslint-disable-next-line no-underscore-dangle
    return Object.values(this._collections);
  }

  getCollection(name: string): T {
    // eslint-disable-next-line no-underscore-dangle
    const collection = this._collections[name];

    if (collection === undefined) throw new Error(`Collection "${name}" not found.`);

    return collection;
  }

  protected addCollection(name: string, collection: T): void {
    // eslint-disable-next-line no-underscore-dangle
    if (this._collections[name] !== undefined)
      throw new Error(`Collection "${name}" already defined in datasource`);

    // eslint-disable-next-line no-underscore-dangle
    this._collections[name] = collection;
  }
}
