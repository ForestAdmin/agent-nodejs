import { Caller } from './interfaces/caller';
import { Chart } from './interfaces/chart';
import { Collection, DataSource } from './interfaces/collection';
import { DataSourceSchema } from './interfaces/schema';

export default class BaseDataSource<T extends Collection = Collection> implements DataSource {
  protected _collections: T[] = [];

  get collections(): T[] {
    return this._collections;
  }

  get schema(): DataSourceSchema {
    return { charts: [] };
  }

  getCollection(name: string): T {
    const collection = this._collections.find(c => c.name === name);

    if (collection === undefined) {
      throw new Error(`Collection '${name}' not found.`);
    }

    return collection;
  }

  public addCollection(collection: T): void {
    if (this._collections.find(c => c.name === collection.name) !== undefined)
      throw new Error(`Collection '${collection.name}' already defined in datasource`);

    this._collections.push(collection);
  }

  renderChart(caller: Caller, name: string): Promise<Chart> {
    throw new Error(`No chart named '${name}' exists on this datasource.`);
  }
}
