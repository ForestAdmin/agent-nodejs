import { DataSource } from '../../interfaces/collection';
import DataSourceDecorator from '../datasource-decorator';
import RenameCollectionCollectionDecorator from './collection';

export default class RenameCollectionDataSourceDecorator extends DataSourceDecorator<RenameCollectionCollectionDecorator> {
  constructor(childDataSource: DataSource) {
    super(childDataSource, RenameCollectionCollectionDecorator);
  }

  renameCollection(oldName: string, newName: string) {
    if (!this._collections[oldName]) {
      throw new Error(`The given collection name "${oldName}" does not exist`);
    }

    const collection = this._collections[oldName] as RenameCollectionCollectionDecorator;
    collection.rename(newName);

    this._collections[newName] = collection;
    delete this._collections[oldName];
  }
}
