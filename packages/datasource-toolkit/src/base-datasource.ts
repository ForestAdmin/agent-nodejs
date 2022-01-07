import { Collection, DataSource } from './interfaces/collection';

export default abstract class BaseDatasource<T extends Collection> implements DataSource {
  readonly collections: T[] = [];

  getCollection(name: string): T {
    const collectionToGet = this.collections.find(collection => collection.name === name);

    if (collectionToGet === undefined) throw new Error(`Collection "${name}" not found.`);

    return collectionToGet;
  }
}
