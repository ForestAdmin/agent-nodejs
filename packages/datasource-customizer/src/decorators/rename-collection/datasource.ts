import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import RenameCollectionCollectionDecorator from './collection';

export default class RenameCollectionDataSourceDecorator extends DataSourceDecorator<RenameCollectionCollectionDecorator> {
  constructor(childDataSource: DataSource) {
    super(childDataSource, RenameCollectionCollectionDecorator);
  }

  renameCollection(oldName: string, newName: string): void {
    // Ensure the new collection name is not already used.
    try {
      this.getCollection(newName);
      throw new Error(`The collection name "${newName}" is already defined in the dataSource`);
    } catch {
      // The collection name is not already used => continue.
    }

    // Rename the collection
    const collection = this.getCollection(oldName);

    if (oldName !== newName) collection.rename(newName);
  }

  renameCollections(rename?: ((oldName: string) => string) | { [oldName: string]: string }): void {
    const tuples =
      typeof rename === 'function'
        ? this.collections.map(({ name }) => [name, rename(name) ?? name])
        : Object.entries(rename ?? {});

    for (const [oldName, newName] of tuples) {
      this.renameCollection(oldName, newName);
    }
  }
}
