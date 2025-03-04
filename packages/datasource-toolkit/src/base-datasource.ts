/* eslint-disable @typescript-eslint/no-unused-vars */
import { MissingCollectionError } from './errors';
import { Caller } from './interfaces/caller';
import { Chart } from './interfaces/chart';
import { Collection, DataSource } from './interfaces/collection';
import { DataSourceSchema } from './interfaces/schema';

export default class BaseDataSource<T extends Collection = Collection> implements DataSource {
  protected _collections: { [collectionName: string]: T } = {};
  protected _nativeQueryConnections: { [connectionName: string]: unknown } = {};

  get collections(): T[] {
    return Object.values(this._collections);
  }

  get nativeQueryConnections(): Record<string, unknown> {
    return this._nativeQueryConnections;
  }

  get schema(): DataSourceSchema {
    return { charts: [] };
  }

  getCollection(name: string): T {
    const collection = this._collections[name];

    if (collection === undefined) {
      throw new MissingCollectionError(
        `Collection '${name}' not found. List of available collections: ${Object.keys(
          this._collections,
        )
          .sort()
          .join(', ')}`,
      );
    }

    return collection;
  }

  addCollection(collection: T): void {
    if (this._collections[collection.name] !== undefined) {
      throw new Error(`Collection '${collection.name}' already defined in datasource`);
    }

    this._collections[collection.name] = collection;
  }

  addNativeQueryConnection(connectionName: string, definition: unknown): void {
    if (this._nativeQueryConnections[connectionName] !== undefined) {
      throw new Error(`NativeQueryConnection '${connectionName}' is already defined in datasource`);
    }

    this._nativeQueryConnections[connectionName] = definition;
  }

  renderChart(caller: Caller, name: string): Promise<Chart> {
    throw new Error(`No chart named '${name}' exists on this datasource.`);
  }

  async executeNativeQuery(
    connectionName: string,
    query: string,
    contextVariables: Record<string, unknown>,
  ): Promise<unknown> {
    throw new Error(`Native Query is not supported on this datasource`);
  }
}
