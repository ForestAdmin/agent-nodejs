import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import PublicationFieldCollectionDecorator from './collection';

export default class PublicationDataSourceDecorator extends DataSourceDecorator<PublicationFieldCollectionDecorator> {
  constructor(childDataSource: DataSource) {
    super(childDataSource, PublicationFieldCollectionDecorator);
  }

  keepCollectionsMatching(include?: string[], exclude?: string[]): void {
    this.validateCollectionNames([...(include ?? []), ...(exclude ?? [])]);

    // List collection we're keeping from the white/black list.
    for (const name of Object.keys(this._collections)) {
      if ((include && !include.includes(name)) || exclude?.includes(name)) {
        this.removeCollection(name);
      }
    }
  }

  removeCollection(collectionName: string): void {
    this.validateCollectionNames([collectionName]);

    // Delete all relations that use the collection we're removing.
    for (const collection of Object.values(this._collections)) {
      for (const [fieldName, field] of Object.entries(collection.schema.fields)) {
        if (
          (field.type !== 'Column' && collectionName === field.foreignCollection) ||
          (field.type === 'ManyToMany' && collectionName === field.throughCollection)
        )
          collection.changeFieldVisibility(fieldName, false);
      }
    }

    // Delete the collection itself.
    delete this._collections[collectionName];
  }

  private validateCollectionNames(names: string[]): void {
    for (const name of names) {
      if (!this._collections[name]) {
        throw new Error(`Unknown collection name: "${name}"`);
      }
    }
  }
}
