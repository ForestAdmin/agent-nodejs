import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import PublicationFieldCollectionDecorator from './collection';

export default class PublicationDataSourceDecorator extends DataSourceDecorator<PublicationFieldCollectionDecorator> {
  blacklist: Set<string> = new Set();

  constructor(childDataSource: DataSource) {
    super(childDataSource, PublicationFieldCollectionDecorator);
  }

  override get collections(): PublicationFieldCollectionDecorator[] {
    return super.collections.filter(collection => !this.blacklist.has(collection.name));
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

    // Delete all relations that use the collection we're removing.
    for (const collection of this.collections) {
      for (const [fieldName, field] of Object.entries(collection.schema.fields)) {
        if (
          (field.type !== 'Column' && collectionName === field.foreignCollection) ||
          (field.type === 'ManyToMany' && collectionName === field.throughCollection)
        )
          collection.changeFieldVisibility(fieldName, false);
      }
    }

    // Delete the collection itself.
    this.blacklist.add(collectionName);
  }

  private validateCollectionNames(names: string[]): void {
    for (const name of names) this.getCollection(name);
  }
}
