import { CollectionSchema } from '../../interfaces/schema';
import CollectionDecorator from '../collection-decorator';

/**
 * This decorator allows to override parts of the collections schema.
 * It can be used to toggle off collection level capabilities for performance
 * (for now, list-view counts and the search bar)
 */
export default class SchemaCollectionDecorator extends CollectionDecorator {
  private schemaOverride: Partial<CollectionSchema> = {};

  overrideSchema(value: Partial<CollectionSchema>): void {
    Object.assign(this.schemaOverride, value);
    this.markSchemaAsDirty();
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return { ...subSchema, ...this.schemaOverride };
  }
}
