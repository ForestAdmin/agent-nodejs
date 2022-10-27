import { DataSource } from '@forestadmin/datasource-toolkit';

import DataSourceDecorator from '../datasource-decorator';
import RenameCollectionCollectionDecorator from './collection';

export default class RenameCollectionDataSourceDecorator extends DataSourceDecorator<RenameCollectionCollectionDecorator> {
  constructor(childDataSource: DataSource) {
    super(childDataSource, RenameCollectionCollectionDecorator);
  }

  renameCollection(oldName: string, newName: string): void {
    if (!this._collections[oldName]) {
      throw new Error(`The given collection name "${oldName}" does not exist`);
    }

    if (this._collections[newName]) {
      throw new Error(
        `The given new collection name "${newName}" is already defined in the dataSource`,
      );
    }

    if (oldName !== newName) {
      const collection = this._collections[oldName] as RenameCollectionCollectionDecorator;
      collection.rename(newName);

      this._collections[newName] = collection;
      delete this._collections[oldName];
    }
  }

  renameCollections(rename?: { [newName: string]: string }): void {
    for (const [oldName, newName] of Object.entries(rename ?? {})) {
      this.renameCollection(oldName, newName);
    }
  }
}
