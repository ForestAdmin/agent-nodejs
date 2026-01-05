import type CollectionRenameDataSourceDecorator from './datasource';
import type { CollectionSchema, FieldSchema } from '@forestadmin/datasource-toolkit';

import { CollectionDecorator } from '@forestadmin/datasource-toolkit';

/**
 * This decorator renames collections.
 * It should be used with RenameCollectionDataSourceDecorator, and not the raw DataSourceDecorator
 */
export default class RenameCollectionCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: CollectionRenameDataSourceDecorator;

  override get name() {
    return this.dataSource.getCollectionName(super.name);
  }

  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, oldSchema] of Object.entries(childSchema.fields)) {
      const schema = { ...oldSchema };

      if (schema.type !== 'Column') {
        schema.foreignCollection = this.dataSource.getCollectionName(schema.foreignCollection);

        if (schema.type === 'ManyToMany') {
          schema.throughCollection = this.dataSource.getCollectionName(schema.throughCollection);
        }
      }

      fields[name] = schema;
    }

    return { ...childSchema, fields };
  }

  /**
   * Override visibility of the markSchemaAsDirty method so that we can call it
   * from the datasource.
   */
  public override markSchemaAsDirty(): void {
    return super.markSchemaAsDirty();
  }
}
