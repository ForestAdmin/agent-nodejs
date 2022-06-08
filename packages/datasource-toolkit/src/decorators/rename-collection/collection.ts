import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';

/**
 * This decorator renames the collection name.
 */
export default class RenameCollectionCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<RenameCollectionCollectionDecorator>;

  private substitutedName: string;

  override get name() {
    return this.substitutedName || this.childCollection.name;
  }

  /** Rename the collection name  */
  rename(name: string): void {
    this.substitutedName = name;
  }
}
