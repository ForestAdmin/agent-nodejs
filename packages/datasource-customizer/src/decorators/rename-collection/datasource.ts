import type { DataSource } from '@forestadmin/datasource-toolkit';

import { DataSourceDecorator } from '@forestadmin/datasource-toolkit';

import RenameCollectionCollectionDecorator from './collection';

export default class RenameCollectionDataSourceDecorator extends DataSourceDecorator<RenameCollectionCollectionDecorator> {
  private fromChildName: Record<string, string> = {};
  private toChildName: Record<string, string> = {};

  constructor(childDataSource: DataSource) {
    super(childDataSource, RenameCollectionCollectionDecorator);
  }

  override get collections(): RenameCollectionCollectionDecorator[] {
    return this.childDataSource.collections.map(({ name }) => super.getCollection(name));
  }

  override getCollection(name: string): RenameCollectionCollectionDecorator {
    // Collection has been renamed, user is using the new name
    if (this.toChildName[name]) {
      return super.getCollection(this.toChildName[name]);
    }

    // Collection has been renamed, user is using the old name
    if (this.fromChildName[name]) {
      throw new Error(`Collection '${name}' has been renamed to '${this.fromChildName[name]}'`);
    }

    // Collection has not been renamed
    return super.getCollection(name);
  }

  /**
   * Helper to rename multiple collections at once.
   * Used by the addDataSource method in DataSourceCustomizer.
   */
  renameCollections(
    rename?: ((oldName: string) => string | null) | { [oldName: string]: string },
  ): void {
    const tuples =
      typeof rename === 'function'
        ? this.collections.map(({ name }) => [name, rename(name) ?? name])
        : Object.entries(rename ?? {});

    for (const [oldName, newName] of tuples) {
      this.renameCollection(oldName, newName);
    }
  }

  /**
   * Rename a single collection
   * Used by the renameCollection method in DataSourceCustomizer.
   * @param currentName
   * @param newName
   */
  renameCollection(currentName: string, newName: string): void {
    // Check collection exists
    this.getCollection(currentName);

    // Rename collection
    if (currentName !== newName) {
      // Check new name is not already used
      if (this.collections.some(({ name }) => name === newName)) {
        throw new Error(`The given new collection name "${newName}" is already defined`);
      }

      // Check we don't rename a collection twice
      if (this.toChildName[currentName]) {
        throw new Error(
          `Cannot rename a collection twice: ` +
            `${this.toChildName[currentName]}->${currentName}->${newName}`,
        );
      }

      this.fromChildName[currentName] = newName;
      this.toChildName[newName] = currentName;

      for (const collection of this.collections) {
        collection.markSchemaAsDirty();
      }
    }
  }

  /** @internal */
  getCollectionName(childName: string): string {
    return this.fromChildName[childName] ?? childName;
  }
}
