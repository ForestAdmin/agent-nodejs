import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import PublicationCollectionDecorator from './collection';

export default class PublicationDataSourceDecorator extends DataSourceDecorator<PublicationCollectionDecorator> {
  blacklist: Set<string> = new Set();

  constructor(childDataSource: DataSource) {
    super(childDataSource, PublicationCollectionDecorator);
  }

  override get collections(): PublicationCollectionDecorator[] {
    return this.childDataSource.collections
      .filter(({ name }) => !this.blacklist.has(name))
      .map(({ name }) => this.getCollection(name));
  }

  override getCollection(name: string): PublicationCollectionDecorator {
    if (this.blacklist.has(name)) throw new Error(`Collection "${name}" was removed.`);

    return super.getCollection(name);
  }

  keepCollectionsMatching(include?: string[], exclude?: string[]): void {
    this.validateCollectionNames([...(include ?? []), ...(exclude ?? [])]);

    // List collection we're keeping from the white/black list.
    for (const { name } of this.collections) {
      if ((include && !include.includes(name)) || exclude?.includes(name)) {
        this.removeCollection(name);
      }
    }
  }

  removeCollection(collectionName: string): void {
    this.validateCollectionNames([collectionName]);

    // Delete the collection
    this.blacklist.add(collectionName);

    // Tell all collections that their schema is dirty: if we removed a collection, all
    // relations to this collection are now invalid and should be unpublished.
    for (const collection of this.collections) {
      collection.markSchemaAsDirty();
    }
  }

  private validateCollectionNames(names: string[]): void {
    for (const name of names) this.getCollection(name);
  }

  isPublished(collectionName: string): boolean {
    return !this.blacklist.has(collectionName);
  }
}
