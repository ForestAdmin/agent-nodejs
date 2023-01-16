import { DataSource } from '@forestadmin/datasource-toolkit';

import RenameCollectionCollectionDecorator from './collection';
import DataSourceDecorator from '../datasource-decorator';

export default class RenameCollectionDataSourceDecorator extends DataSourceDecorator<RenameCollectionCollectionDecorator> {
  constructor(childDataSource: DataSource) {
    super(childDataSource, RenameCollectionCollectionDecorator);
  }

  renameCollection(oldName: string, newName: string): void {
    if (!this._collections[oldName]) {
      throw new Error(`The given collection name "${oldName}" does not exist`);
    }

    if (oldName !== newName) {
      if (this._collections[newName]) {
        throw new Error(
          `The given new collection name "${newName}" is already defined in the dataSource`,
        );
      }

      const collection = this._collections[oldName] as RenameCollectionCollectionDecorator;
      collection.rename(newName);

      this._collections[newName] = collection;
      delete this._collections[oldName];
    }
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
