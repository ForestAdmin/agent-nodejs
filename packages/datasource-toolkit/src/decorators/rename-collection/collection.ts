import { CollectionSchema, FieldSchema } from '../../interfaces/schema';
import CollectionDecorator from '../collection-decorator';
import CollectionRenameDataSourceDecorator from './datasource';

/**
 * This decorator renames collections.
 * It should be used with RenameCollectionDataSourceDecorator, and not the raw DataSourceDecorator
 */
export default class RenameCollectionCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: CollectionRenameDataSourceDecorator;

  private substitutedName: string = null;

  override get name() {
    return this.substitutedName ?? this.childCollection.name;
  }

  /** @internal */
  rename(name: string): void {
    this.substitutedName = name;

    // Invalidate all schemas
    for (const collection of this.dataSource.collections) {
      collection.markSchemaAsDirty();
    }
  }

  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, oldSchema] of Object.entries(childSchema.fields)) {
      const schema = { ...oldSchema };

      if (schema.type === 'ManyToOne') {
        schema.foreignCollection = this.getNewName(schema.foreignCollection);
      } else if (schema.type === 'OneToMany' || schema.type === 'OneToOne') {
        schema.foreignCollection = this.getNewName(schema.foreignCollection);
      } else if (schema.type === 'ManyToMany') {
        schema.throughCollection = this.getNewName(schema.throughCollection);
        schema.foreignCollection = this.getNewName(schema.foreignCollection);
      }

      fields[name] = schema;
    }

    return { ...childSchema, fields };
  }

  private getNewName(oldName: string): string {
    return this.dataSource.collections.find(c => c.childCollection.name === oldName).name;
  }
}
