import { DataSource, DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import PublicationFieldCollectionDecorator from '../publication-field/collection';

export default class PublicationCollectionDataSourceDecorator extends DataSourceDecorator<PublicationFieldCollectionDecorator> {
  constructor(childDataSource: DataSource) {
    super(childDataSource, PublicationFieldCollectionDecorator);
  }

  keepCollectionsMatching(include?: string[], exclude?: string[]): void {
    this.validateCollectionNames([...(include ?? []), ...(exclude ?? [])]);

    const deleted = new Set<string>();

    // List collection we're keeping from the white/black list.
    for (const name of Object.keys(this._collections)) {
      if ((include && !include.includes(name)) || exclude?.includes(name)) {
        deleted.add(name);
      }
    }

    // Delete the relations to the collections we're not keeping.
    for (const collection of Object.values(this._collections)) {
      for (const [fieldName, field] of Object.entries(collection.schema.fields)) {
        if (
          (field.type !== 'Column' && deleted.has(field.foreignCollection)) ||
          (field.type === 'ManyToMany' && deleted.has(field.throughCollection))
        )
          collection.changeFieldVisibility(fieldName, false);
      }
    }

    // Delete the collections themselves.
    for (const name of deleted.values()) {
      delete this._collections[name];
    }
  }

  private validateCollectionNames(names: string[]): void {
    for (const name of names) {
      if (!this._collections[name]) {
        throw new Error(`Unknown collection name: "${name}"`);
      }
    }
  }
}
