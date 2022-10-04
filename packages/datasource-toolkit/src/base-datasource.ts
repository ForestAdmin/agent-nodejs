import { Caller } from './interfaces/caller';
import { Chart } from './interfaces/chart';
import { Collection, DataSource } from './interfaces/collection';
import { DataSourceSchema } from './interfaces/schema';

export default class BaseDataSource<T extends Collection = Collection> implements DataSource {
  protected _collections: { [collectionName: string]: T } = {};

  get collections(): T[] {
    return Object.values(this._collections);
  }

  get schema(): DataSourceSchema {
    return { charts: [] };
  }

  getCollection(name: string): T {
    const collection = this._collections[name];

    if (collection === undefined)
      throw new Error(
        `Collection '${name}' not found. List of available collections: ${Object.keys(
          this._collections,
        )
          .sort()
          .join(', ')}`,
      );

    return collection;
  }

  public addCollection(collection: T): void {
    if (this._collections[collection.name] !== undefined)
      throw new Error(`Collection '${collection.name}' already defined in datasource`);

    this._collections[collection.name] = collection;
  }

  renderChart(caller: Caller, name: string): Promise<Chart> {
    throw new Error(`No chart named '${name}' exists on this datasource.`);
  }
}
